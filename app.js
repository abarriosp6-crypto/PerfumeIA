
require("dotenv").config();

const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const Groq = require("groq-sdk");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const crypto = require("node:crypto");

const app = express();
const PORT = 3000;

if (
  !process.env.GROQ_API_KEY ||
  !process.env.ADMIN_PASSWORD_HASH ||
  !process.env.SESSION_SECRET ||
  process.env.SESSION_SECRET.length < 32
) {
  console.error("Faltan variables de seguridad en .env");
  process.exit(1);
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

app.disable("x-powered-by");

app.use(express.json({ limit: "20kb" }));

// ==========================================
// SESIONES
// ==========================================

app.use(session({
  name: "perfumeia.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 1000
  }
}));

// En producción se debe usar HTTPS,
// configurar correctamente el proxy
// y un almacén persistente de sesiones.

// ==========================================
// PROTECCIÓN DE SOLICITUDES
// ==========================================

function mismoOrigen(req, res, next) {
  const origen = req.get("origin");

  if (origen) {
    try {
      const url = new URL(origen);
      const esperado = `${req.protocol}://${req.get("host")}`;

      if (url.origin !== esperado) {
        return res.status(403).json({
          error: "Origen no autorizado."
        });
      }
    } catch {
      return res.status(403).json({
        error: "Origen inválido."
      });
    }
  }

  next();
}

app.use("/api", mismoOrigen);

function requiereAdmin(req, res, next) {
  if (req.session?.administrador === true) {
    return next();
  }

  return res.status(401).json({
    error: "Debes iniciar sesión como administrador."
  });
}
// ==========================================
// VERIFICAR USUARIO AUTENTICADO
// ==========================================

function requiereUsuario(req, res, next) {
  const esAdmin = req.session?.administrador === true;

  const esUsuario =
    Number.isSafeInteger(req.session?.usuarioId) &&
    req.session.usuarioId > 0 &&
    req.session.usuarioRol === "usuario";

  if (!esAdmin && !esUsuario) {
    return res.status(401).json({
      error: "Debes iniciar sesión para utilizar PerfumeIA."
    });
  }

  next();
}

// ==========================================
// ARCHIVOS PÚBLICOS
// ==========================================

app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// BASE DE DATOS
// ==========================================

const db = new sqlite3.Database(
  path.join(__dirname, "perfumeia.db"),
  error => {
    if (error) {
      console.error("Error de SQLite:", error.message);
    } else {
      console.log("Base de datos conectada correctamente.");
    }
  }
);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS historial (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      consulta TEXT NOT NULL,
      respuesta TEXT NOT NULL
    )
  `);
  // Tabla de usuarios registrados
db.run(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    correo TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'usuario'
      CHECK (rol IN ('usuario', 'administrador')),
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (error) => {
  if (error) {
    console.error(
      "Error al crear la tabla usuarios:",
      error.message
    );
  } else {
    console.log("Tabla de usuarios verificada correctamente.");
  }
});

  db.run(`
  CREATE TABLE IF NOT EXISTS perfumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    marca TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    tipo_aroma TEXT NOT NULL,
    genero TEXT NOT NULL DEFAULT 'Unisex',
    disponible INTEGER NOT NULL DEFAULT 1
  )
`);
// ==========================================
// PRESENTACIONES DE PERFUMES EN MILILITROS
// ==========================================

db.run(`
  CREATE TABLE IF NOT EXISTS presentaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    perfume_id INTEGER NOT NULL,
    mililitros INTEGER NOT NULL CHECK (mililitros > 0),
    disponible INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (perfume_id) REFERENCES perfumes(id) ON DELETE CASCADE,
    UNIQUE (perfume_id, mililitros)
  )
`, (error) => {
  if (error) {
    console.error("Error al crear la tabla de presentaciones:", error.message);
  } else {
    console.log("Tabla de presentaciones verificada correctamente.");
  }
});
  db.get(
    "SELECT COUNT(*) AS total FROM perfumes",
    [],
    (error, fila) => {
      if (error) {
        console.error(error.message);
        return;
      }

      if (fila.total > 0) {
        console.log("Catálogo existente conservado.");
        return;
      }

      const iniciales = [
        ["Sauvage", "Dior",
          "Fragancia masculina con notas frescas y especiadas. Ideal para uso diario.",
          "Fresco aromático", 1],
        ["Bleu de Chanel", "Chanel",
          "Perfume elegante y versátil, recomendado para ocasiones casuales y formales.",
          "Amaderado aromático", 1],
        ["Acqua di Giò", "Giorgio Armani",
          "Aroma ligero y refrescante, ideal para climas calurosos.",
          "Acuático cítrico", 1],
        ["Libre", "Yves Saint Laurent",
          "Fragancia femenina elegante con notas de lavanda y flores blancas.",
          "Floral", 1],
        ["La Vie Est Belle", "Lancôme",
          "Perfume femenino con notas dulces y florales para ocasiones especiales.",
          "Dulce floral", 1],
        ["Eros", "Versace",
          "Fragancia masculina intensa con notas frescas, dulces y amaderadas.",
          "Aromático dulce", 1]
      ];

      const insertar = db.prepare(`
        INSERT INTO perfumes
        (nombre, marca, descripcion, tipo_aroma, disponible)
        VALUES (?, ?, ?, ?, ?)
      `);

      iniciales.forEach(perfume => insertar.run(perfume));

      insertar.finalize(error => {
        if (error) {
          console.error(error.message);
        } else {
          console.log("Catálogo inicial guardado.");
        }
      });
    }
  );
});

// ==========================================
// INICIO DE SESIÓN
// ==========================================
// ==========================================
// REGISTRO DE USUARIOS
// ==========================================

const limitarRegistro = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Demasiados registros. Intenta más tarde."
  }
});

app.post("/api/usuarios/registro", limitarRegistro, async (req, res) => {
  const { nombre, correo, password } = req.body || {};

  // Validar los datos
  if (
    typeof nombre !== "string" ||
    nombre.trim().length < 2 ||
    nombre.trim().length > 100 ||
    typeof correo !== "string" ||
    correo.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ||
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 72
  ) {
    return res.status(400).json({
      error: "Verifica tus datos. La contraseña debe tener entre 10 y 72 caracteres."
    });
  }

  const nombreLimpio = nombre.trim();
  const correoLimpio = correo.trim().toLowerCase();

  try {
    // Proteger la contraseña
    const passwordHash = await bcrypt.hash(password, 12);

    // Registrar siempre con el rol usuario
    db.run(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol)
       VALUES (?, ?, ?, 'usuario')`,
      [nombreLimpio, correoLimpio, passwordHash],
      function(error) {
        if (error) {
          if (error.code === "SQLITE_CONSTRAINT") {
            return res.status(409).json({
              error: "No se pudo registrar este correo."
            });
          }

          console.error("Error al registrar usuario:", error.message);

          return res.status(500).json({
            error: "No se pudo completar el registro."
          });
        }

        res.status(201).json({
          mensaje: "Usuario registrado correctamente.",
          usuario: {
            id: this.lastID,
            nombre: nombreLimpio,
            correo: correoLimpio,
            rol: "usuario"
          }
        });
      }
    );

  } catch (error) {
    console.error("Error de registro:", error.message);

    res.status(500).json({
      error: "Error interno al registrar usuario."
    });
  }
});
const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos. Espera 15 minutos."
  }
});

app.post("/api/admin/login", limitarLogin, async (req, res) => {
  const { password } = req.body || {};

  if (
    typeof password !== "string" ||
    password.length > 200
  ) {
    return res.status(400).json({
      error: "Contraseña inválida."
    });
  }

  try {
    const valido = await bcrypt.compare(
      password,
      process.env.ADMIN_PASSWORD_HASH
    );

    if (!valido) {
      return res.status(401).json({
        error: "Contraseña incorrecta."
      });
    }

    req.session.regenerate(error => {
      if (error) {
        return res.status(500).json({
          error: "No se pudo iniciar sesión."
        });
      }

      req.session.administrador = true;

      req.session.save(error => {
        if (error) {
          return res.status(500).json({
            error: "No se pudo guardar la sesión."
          });
        }

        res.json({
          mensaje: "Sesión iniciada correctamente.",
          administrador: true
        });
      });
    });

  } catch (error) {
    console.error("Error de autenticación:", error.message);

    res.status(500).json({
      error: "Error al iniciar sesión."
    });
  }
});
// ==========================================
// INICIO DE SESIÓN DE USUARIOS
// ==========================================

app.post("/api/usuarios/login", limitarLogin, (req, res) => {
  const { correo, password } = req.body || {};

  // Validar datos recibidos
  if (
    typeof correo !== "string" ||
    correo.length > 254 ||
    typeof password !== "string" ||
    password.length === 0 ||
    password.length > 200
  ) {
    return res.status(400).json({
      error: "Correo o contraseña inválidos."
    });
  }

  const correoLimpio = correo.trim().toLowerCase();

  // Buscar al usuario en SQLite
  db.get(
    `SELECT id, nombre, correo, password_hash, rol
     FROM usuarios
     WHERE correo = ?`,
    [correoLimpio],
    async (error, usuario) => {
      if (error) {
        console.error("Error al buscar usuario:", error.message);

        return res.status(500).json({
          error: "Error al iniciar sesión."
        });
      }

      try {
        // Verificar la contraseña
        const valido = usuario
          ? await bcrypt.compare(password, usuario.password_hash)
          : false;

        if (!valido) {
          return res.status(401).json({
            error: "Correo o contraseña incorrectos."
          });
        }

        // Crear una nueva sesión segura
        req.session.regenerate(error => {
          if (error) {
            return res.status(500).json({
              error: "No se pudo iniciar sesión."
            });
          }

          // Guardar únicamente los datos necesarios
          req.session.usuarioId = usuario.id;
          req.session.usuarioNombre = usuario.nombre;
          req.session.usuarioRol = "usuario";
          req.session.administrador = false;

          req.session.save(error => {
            if (error) {
              return res.status(500).json({
                error: "No se pudo guardar la sesión."
              });
            }

            res.json({
              mensaje: "Sesión iniciada correctamente.",
              usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                correo: usuario.correo,
                rol: "usuario"
              }
            });
          });
        });

      } catch (error) {
        console.error("Error de autenticación:", error.message);

        res.status(500).json({
          error: "Error al iniciar sesión."
        });
      }
    }
  );
});
// ==========================================
// VERIFICAR SESIÓN DEL USUARIO
// ==========================================

app.get("/api/usuarios/sesion", (req, res) => {

  // Verificar si hay un administrador autenticado
  if (req.session?.administrador === true) {
    return res.json({
      autenticado: true,
      rol: "administrador"
    });
  }

  // Verificar si hay un usuario autenticado
  if (
    Number.isSafeInteger(req.session?.usuarioId) &&
    req.session.usuarioId > 0 &&
    req.session.usuarioRol === "usuario"
  ) {
    return res.json({
      autenticado: true,
      usuario: {
        id: req.session.usuarioId,
        nombre: req.session.usuarioNombre,
        rol: "usuario"
      }
    });
  }

  // Visitante sin sesión
  return res.json({
    autenticado: false,
    usuario: null
  });

});

app.get("/api/admin/sesion", (req, res) => {
  res.json({
    administrador: req.session?.administrador === true
  });
});

app.post("/api/admin/logout", requiereAdmin, (req, res) => {
  req.session.destroy(error => {
    if (error) {
      return res.status(500).json({
        error: "No se pudo cerrar sesión."
      });
    }

    res.clearCookie("perfumeia.sid");

    res.json({
      mensaje: "Sesión cerrada correctamente."
    });
  });
});


 // ==========================================
 // CERRAR SESIÓN DE USUARIOS
 // ==========================================

app.post("/api/usuarios/logout", (req, res) => {
  req.session.destroy(error => {
    if (error) {
      return res.status(500).json({
        error: "No se pudo cerrar sesión."
      });
    }

    res.clearCookie("perfumeia.sid");

    res.json({
      mensaje: "Sesión cerrada correctamente."
    });
  });
});

// ==========================================
// CATÁLOGO PÚBLICO
// ==========================================

app.get("/api/perfumes", (req, res) => {
  db.all(`
    SELECT id, nombre, marca, genero, descripcion,
           tipo_aroma, disponible
    FROM perfumes
    ORDER BY id ASC
  `, [], (error, filas) => {
    if (error) {
      return res.status(500).json({
        error: "No fue posible cargar el catálogo."
      });
    }

    res.json(filas);
  });
});

// ==========================================
// VALIDACIÓN ADMINISTRATIVA
// ==========================================

function validarPerfume(datos) {
  if (!datos || typeof datos !== "object") {
    return null;
  }

  const campos = [
    "nombre", "marca", "descripcion", "tipo_aroma"
  ];

  const perfume = {};

  for (const campo of campos) {
    if (
      typeof datos[campo] !== "string" ||
      !datos[campo].trim() ||
      datos[campo].trim().length > 500
    ) {
      return null;
    }

    perfume[campo] = datos[campo].trim();
  }

  if (
    datos.disponible !== 0 &&
    datos.disponible !== 1
  ) {
    return null;
  }

  const generosPermitidos = ["Hombre", "Mujer", "Unisex"];

if (
  typeof datos.genero !== "string" ||
  !generosPermitidos.includes(datos.genero)
) {
  return null;
}

perfume.genero = datos.genero;
  perfume.disponible = datos.disponible;
  return perfume;
}

// ==========================================
// AGREGAR PERFUME CON PRESENTACIONES EN ML
// ==========================================

app.post("/api/admin/perfumes", requiereAdmin, (req, res) => {

  const perfume = validarPerfume(req.body);

  if (!perfume) {
    return res.status(400).json({
      error: "Datos del perfume incorrectos."
    });
  }

  // Validar las presentaciones recibidas
  const presentaciones = req.body.presentaciones;

  if (
    !Array.isArray(presentaciones) ||
    presentaciones.length === 0 ||
    !presentaciones.every(
      ml => Number.isInteger(ml) && ml >= 1 && ml <= 1000
    ) ||
    new Set(presentaciones).size !== presentaciones.length
  ) {
    return res.status(400).json({
      error: "Debes agregar presentaciones válidas y sin repetir."
    });
  }

  // Iniciar transacción
  db.serialize(() => {

    db.run("BEGIN TRANSACTION", error => {

      if (error) {
        return res.status(500).json({
          error: "No fue posible iniciar el registro."
        });
      }

      db.run(
        `INSERT INTO perfumes
        (nombre, marca, descripcion, tipo_aroma, genero, disponible)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          perfume.nombre,
          perfume.marca,
          perfume.descripcion,
          perfume.tipo_aroma,
          perfume.genero,
          perfume.disponible
        ],
        function(error) {

          if (error) {
            return db.run("ROLLBACK", () => {
              res.status(500).json({
                error: "No fue posible registrar el perfume."
              });
            });
          }

          const perfumeId = this.lastID;

          // Preparar inserción de presentaciones
          const insertarPresentacion = db.prepare(
            `INSERT INTO presentaciones
            (perfume_id, mililitros, disponible)
            VALUES (?, ?, 1)`
          );

          let errorPresentaciones = null;

          presentaciones.forEach(ml => {
            insertarPresentacion.run(
              perfumeId,
              ml,
              error => {
                if (error) {
                  errorPresentaciones = error;
                }
              }
            );
          });

          insertarPresentacion.finalize(error => {

            if (error || errorPresentaciones) {
              return db.run("ROLLBACK", () => {
                res.status(500).json({
                  error: "No fue posible guardar las presentaciones."
                });
              });
            }

            db.run("COMMIT", error => {

              if (error) {
                return db.run("ROLLBACK", () => {
                  res.status(500).json({
                    error: "No fue posible completar el registro."
                  });
                });
              }

              res.status(201).json({
                mensaje: "Perfume y presentaciones registrados correctamente.",
                id: perfumeId
              });

            });

          });

        }
      );

    });

  });

});

// ==========================================
// EDITAR PERFUME Y SUS PRESENTACIONES
// ==========================================

app.put("/api/admin/perfumes/:id", requiereAdmin, (req, res) => {
  const id = Number(req.params.id);
  const perfume = validarPerfume(req.body);
  const presentaciones = req.body.presentaciones;

  // Validar identificador y datos del perfume
  if (!Number.isSafeInteger(id) || id < 1 || !perfume) {
    return res.status(400).json({
      error: "Datos incorrectos."
    });
  }

  // Validar presentaciones
  if (
    !Array.isArray(presentaciones) ||
    presentaciones.length === 0 ||
    !presentaciones.every(
      ml => Number.isInteger(ml) && ml >= 1 && ml <= 1000
    ) ||
    new Set(presentaciones).size !== presentaciones.length
  ) {
    return res.status(400).json({
      error: "Debes agregar presentaciones válidas y sin repetir."
    });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION", error => {
      if (error) {
        return res.status(500).json({
          error: "No fue posible iniciar la actualización."
        });
      }

      // Actualizar datos generales del perfume
      db.run(
        `UPDATE perfumes
         SET nombre = ?,
             marca = ?,
             descripcion = ?,
             tipo_aroma = ?,
             genero = ?,
             disponible = ?
         WHERE id = ?`,
        [
          perfume.nombre,
          perfume.marca,
          perfume.descripcion,
          perfume.tipo_aroma,
          perfume.genero,
          perfume.disponible,
          id
        ],
        function(error) {
          if (error) {
            return db.run("ROLLBACK", () => {
              res.status(500).json({
                error: "No fue posible actualizar el perfume."
              });
            });
          }

          if (this.changes === 0) {
            return db.run("ROLLBACK", () => {
              res.status(404).json({
                error: "Perfume no encontrado."
              });
            });
          }

          // Eliminar las presentaciones anteriores
          db.run(
            "DELETE FROM presentaciones WHERE perfume_id = ?",
            [id],
            error => {
              if (error) {
                return db.run("ROLLBACK", () => {
                  res.status(500).json({
                    error: "No fue posible actualizar las presentaciones."
                  });
                });
              }

              // Registrar las presentaciones actualizadas
              const insertar = db.prepare(
                `INSERT INTO presentaciones
                 (perfume_id, mililitros, disponible)
                 VALUES (?, ?, 1)`
              );

              let errorPresentaciones = null;

              presentaciones.forEach(ml => {
                insertar.run(id, ml, error => {
                  if (error) {
                    errorPresentaciones = error;
                  }
                });
              });

              insertar.finalize(error => {
                if (error || errorPresentaciones) {
                  return db.run("ROLLBACK", () => {
                    res.status(500).json({
                      error: "No fue posible guardar las presentaciones."
                    });
                  });
                }

                db.run("COMMIT", error => {
                  if (error) {
                    return db.run("ROLLBACK", () => {
                      res.status(500).json({
                        error: "No fue posible completar la actualización."
                      });
                    });
                  }

                  res.json({
                    mensaje: "Perfume y presentaciones actualizados correctamente."
                  });
                });
              });
            }
          );
        }
      );
    });
  });
});

// ==========================================
// ELIMINAR PERFUME
// ==========================================

app.delete("/api/admin/perfumes/:id", requiereAdmin, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({
      error: "Identificador inválido."
    });
  }

  db.run(
    "DELETE FROM perfumes WHERE id = ?",
    [id],
    function(error) {
      if (error) {
        return res.status(500).json({
          error: "No fue posible eliminar el perfume."
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          error: "Perfume no encontrado."
        });
      }

      res.json({
        mensaje: "Perfume eliminado correctamente."
      });
    }
  );
});

// ==========================================
// RECOMENDACIONES CON GROQ
// ==========================================

const limitarConsultas = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Demasiadas consultas. Intenta más tarde."
  }
});

app.post(
  "/api/recomendar",
  requiereUsuario,
  limitarConsultas,
  async (req, res) => {
  const { consulta } = req.body || {};

  if (
    typeof consulta !== "string" ||
    consulta.trim().length < 10 ||
    consulta.length > 500
  ) {
    return res.status(400).json({
      error: "La consulta debe tener entre 10 y 500 caracteres."
    });
  }

  try {
    const respuestaIA = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content: `
Eres PerfumeIA, un asistente especializado
en recomendaciones de perfumes.

Recomienda EXACTAMENTE 2 perfumes según
los gustos, ocasión, clima y necesidades
indicadas por el cliente.

Responde SIEMPRE con este formato:

PERFUME 1: Nombre del perfume
TIPO: Tipo de aroma
MOTIVO: Explicación breve de por qué lo recomiendas

PERFUME 2: Nombre del perfume
TIPO: Tipo de aroma
MOTIVO: Explicación breve de por qué lo recomiendas

REGLAS:
- No utilices Markdown.
- No utilices asteriscos.
- No utilices listas con guiones.
- No agregues precios.
- No agregues texto antes de PERFUME 1.
- No agregues texto después del segundo MOTIVO.
- Las recomendaciones deben ser claras y breves.
`
        },
        {
          role: "user",
          content: consulta.trim()
        }
      ]
    });

    const recomendacion =
      respuestaIA.choices[0]?.message?.content;

    if (!recomendacion) {
      throw new Error("La IA devolvió una respuesta vacía.");
    }

    db.run(`
      INSERT INTO historial (consulta, respuesta)
      VALUES (?, ?)
    `, [consulta.trim(), recomendacion], function(error) {
      if (error) {
        return res.status(500).json({
          error: "No fue posible guardar la recomendación."
        });
      }

      res.json({
        mensaje: "Recomendación generada correctamente.",
        id: this.lastID,
        consulta: consulta.trim(),
        recomendacion
      });
    });

  } catch (error) {
    console.error("Error de IA:", error.message);

    res.status(500).json({
      error: "No fue posible obtener la recomendación."
    });
  }
});

// ==========================================
// HISTORIAL PRIVADO
// ==========================================

app.get("/api/historial", requiereAdmin, (req, res) => {
  db.all(`
    SELECT id, fecha, consulta, respuesta
    FROM historial
    ORDER BY id DESC
  `, [], (error, filas) => {
    if (error) {
      return res.status(500).json({
        error: "No fue posible consultar el historial."
      });
    }

    res.json(filas);
  });
});
// ==========================================
// CONSULTAR PRESENTACIONES DE UN PERFUME
// ==========================================

app.get("/api/perfumes/:id/presentaciones", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({
      error: "Identificador de perfume incorrecto."
    });
  }

  db.get(
    "SELECT id FROM perfumes WHERE id = ?",
    [id],
    (error, perfume) => {
      if (error) {
        return res.status(500).json({
          error: "No fue posible consultar el perfume."
        });
      }

      if (!perfume) {
        return res.status(404).json({
          error: "Perfume no encontrado."
        });
      }

      db.all(
        `SELECT id, mililitros, disponible
         FROM presentaciones
         WHERE perfume_id = ?
         ORDER BY mililitros ASC`,
        [id],
        (error, presentaciones) => {
          if (error) {
            return res.status(500).json({
              error: "No fue posible consultar las presentaciones."
            });
          }

          res.json({
            presentaciones
          });
        }
      );
    }
  );
});
// ==========================================
// INICIAR SERVIDOR
// ==========================================

app.listen(PORT, () => {
  console.log("");
  console.log("=================================");
  console.log("       PERFUMEIA FUNCIONANDO");
  console.log("=================================");
  console.log(`Servidor: http://localhost:${PORT}`);
  console.log("Groq: preparado");
  console.log("SQLite: preparado");
  console.log("Autenticación: configurada");
  console.log("Historial: privado");
  console.log("=================================");
});
