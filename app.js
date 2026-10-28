
require("dotenv").config();

const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const Groq = require("groq-sdk");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const crypto = require("node:crypto");
const nodemailer = require("nodemailer");
// ==========================================
// CONFIGURACIÓN DEL CORREO ELECTRÓNICO
// ==========================================

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

const app = express();
const PORT = 3000;

// ==========================================
// VALIDACIÓN DE VARIABLES DE SEGURIDAD
// ==========================================

if (
  !process.env.GROQ_API_KEY ||
  !process.env.ADMIN_PASSWORD_HASH ||
  !process.env.SESSION_SECRET ||
  process.env.SESSION_SECRET.length < 32 ||
  !process.env.EMAIL_USER ||
  !process.env.EMAIL_APP_PASSWORD
) {
  console.error("Faltan variables de seguridad en .env");
  process.exit(1);
}

console.log("Variables de seguridad verificadas correctamente.");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});
// ==========================================
// CORREO ELECTRÓNICO - PERFUMEIA
// ==========================================

const correoTransporte = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
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
  // ==========================================
// ASOCIAR EL HISTORIAL A CADA USUARIO
// ==========================================

db.all("PRAGMA table_info(historial)", [], (error, columnas) => {
  if (error) {
    console.error("Error al verificar historial:", error.message);
    return;
  }

  const tieneUsuarioId = columnas.some(
    columna => columna.name === "usuario_id"
  );

  if (!tieneUsuarioId) {
    db.run(
      "ALTER TABLE historial ADD COLUMN usuario_id INTEGER",
      error => {
        if (error) {
          console.error(
            "Error al actualizar historial:",
            error.message
          );
        } else {
          console.log(
            "Historial actualizado para identificar usuarios."
          );
        }
      }
    );
  } else {
    console.log("Historial de usuarios verificado correctamente.");
  }
});
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
// ==========================================
// RECUPERACIÓN DE CONTRASEÑAS
// ==========================================

db.run(`
  CREATE TABLE IF NOT EXISTS recuperacion_password (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    fecha_expiracion INTEGER NOT NULL,
    utilizado INTEGER NOT NULL DEFAULT 0
      CHECK (utilizado IN (0, 1)),
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id)
      REFERENCES usuarios(id)
      ON DELETE CASCADE
  )
`, (error) => {
  if (error) {
    console.error(
      "Error al crear la tabla de recuperación:",
      error.message
    );
  } else {
    console.log(
      "Tabla de recuperación de contraseñas verificada correctamente."
    );
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
// SOLICITAR RECUPERACIÓN DE CONTRASEÑA
// ==========================================

const limitarRecuperacion = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Demasiadas solicitudes. Intenta nuevamente más tarde."
  }
});

// ==========================================
// LIMITAR SOLICITUDES DE RECUPERACIÓN
// ==========================================
const limitarRestablecimiento = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos. Intenta nuevamente más tarde."
  }
});

// ==========================================
// SOLICITAR RECUPERACIÓN DE CONTRASEÑA
// ==========================================

app.post("/api/usuarios/recuperar-password", limitarRecuperacion, (req, res) => {
  const { correo } = req.body || {};

  if (
    typeof correo !== "string" ||
    correo.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())
  ) {
    return res.status(400).json({
      error: "Ingresa un correo electrónico válido."
    });
  }

  const correoLimpio = correo.trim().toLowerCase();

  const mensaje = {
    mensaje: "Si el correo está registrado, recibirás un enlace para recuperar tu contraseña."
  };

  db.get(
    "SELECT id, nombre, correo FROM usuarios WHERE correo = ?",
    [correoLimpio],
    (error, usuario) => {
      if (error) {
        console.error("Error al consultar usuario:", error.message);

        return res.status(500).json({
          error: "No se pudo procesar la solicitud."
        });
      }

      if (!usuario) {
        return res.json(mensaje);
      }

      const token = crypto.randomBytes(32).toString("hex");

      const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      const expiracion = Date.now() + 15 * 60 * 1000;

      db.run(
        `INSERT INTO recuperacion_password
         (usuario_id, token_hash, fecha_expiracion)
         VALUES (?, ?, ?)`,
        [usuario.id, tokenHash, expiracion],
        function (error) {
          if (error) {
            console.error("Error al guardar token:", error.message);

            return res.status(500).json({
              error: "No se pudo procesar la solicitud."
            });
          }

          const recuperacionId = this.lastID;

          const enlace =
            `http://localhost:3000/?recuperar=${encodeURIComponent(token)}`;

          transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: usuario.correo,
            subject: "Recuperación de contraseña - PerfumeIA",
            text: `Hola ${usuario.nombre}:

Recibimos una solicitud para recuperar tu contraseña de PerfumeIA.

Utiliza el siguiente enlace:

${enlace}

Este enlace vence en 15 minutos.

Si no solicitaste este cambio, puedes ignorar este mensaje.

Equipo PerfumeIA`
          })
          .then(() => {
            return res.json(mensaje);
          })
          .catch(error => {
            console.error("Error al enviar correo:", error.message);

            db.run(
              `UPDATE recuperacion_password
               SET utilizado = 1
               WHERE id = ?`,
              [recuperacionId],
              errorBD => {
                if (errorBD) {
                  console.error(
                    "Error al invalidar token:",
                    errorBD.message
                  );
                }
              }
            );

            return res.status(500).json({
              error: "No se pudo enviar el correo de recuperación."
            });
          });
        }
      );
    }
  );
});

// ==========================================
// RESTABLECER CONTRASEÑA CON TOKEN
// ==========================================

app.post(
  "/api/usuarios/restablecer-password",
  limitarRestablecimiento,
  async (req, res) => {
    const { token, password } = req.body || {};

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/i.test(token) ||
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        error: "Enlace inválido o contraseña no válida (mínimo 8 caracteres y máximo 72 bytes)."
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const ahora = Date.now();

    try {
      const nuevoHash = await bcrypt.hash(password, 12);

      db.serialize(() => {
        db.run("BEGIN IMMEDIATE TRANSACTION", error => {
          if (error) {
            console.error("Error al iniciar transacción:", error.message);

            return res.status(500).json({
              error: "No se pudo restablecer la contraseña."
            });
          }

          db.get(
            `SELECT id, usuario_id
             FROM recuperacion_password
             WHERE token_hash = ?
               AND utilizado = 0
               AND fecha_expiracion > ?`,
            [tokenHash, ahora],
            (error, recuperacion) => {
              if (error || !recuperacion) {
                return db.run("ROLLBACK", () => {
                  return res.status(error ? 500 : 400).json({
                    error: error
                      ? "No se pudo validar el enlace."
                      : "El enlace es inválido, ya fue utilizado o ha vencido."
                  });
                });
              }

              db.run(
                `UPDATE recuperacion_password
                 SET utilizado = 1
                 WHERE id = ? AND utilizado = 0`,
                [recuperacion.id],
                function (error) {
                  if (error || this.changes !== 1) {
                    return db.run("ROLLBACK", () => {
                      return res.status(500).json({
                        error: "No se pudo utilizar el enlace."
                      });
                    });
                  }

                  db.run(
                    `UPDATE usuarios
                     SET password_hash = ?
                     WHERE id = ?`,
                    [nuevoHash, recuperacion.usuario_id],
                    function (error) {
                      if (error || this.changes !== 1) {
                        return db.run("ROLLBACK", () => {
                          return res.status(500).json({
                            error: "No se pudo actualizar la contraseña."
                          });
                        });
                      }

                      db.run(
                        `UPDATE recuperacion_password
                         SET utilizado = 1
                         WHERE usuario_id = ?`,
                        [recuperacion.usuario_id],
                        error => {
                          if (error) {
                            return db.run("ROLLBACK", () => {
                              return res.status(500).json({
                                error: "No se pudo completar la operación."
                              });
                            });
                          }

                          db.run("COMMIT", error => {
                            if (error) {
                              return db.run("ROLLBACK", () => {
                                return res.status(500).json({
                                  error: "No se pudo guardar la contraseña."
                                });
                              });
                            }

                            return res.json({
                              mensaje: "Contraseña restablecida correctamente. Ya puedes iniciar sesión."
                            });
                          });
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        });
      });
    } catch (error) {
      console.error("Error al restablecer contraseña:", error.message);

      return res.status(500).json({
        error: "No se pudo restablecer la contraseña."
      });
    }
  }
);
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
Eres PerfumeIA, un asistente inteligente especializado
en perfumes y recomendaciones personalizadas.

OBJETIVO PRINCIPAL:

Recomendar los perfumes que mejor se adapten
a las necesidades y preferencias del usuario.

REGLA FUNDAMENTAL:

Las preferencias expresadas por el cliente tienen
prioridad sobre cualquier criterio general.

ANÁLISIS DE PREFERENCIAS:

Antes de recomendar, identifica:

1. Tipo de aroma solicitado.
2. Duración deseada.
3. Ocasión de uso.
4. Clima.
5. Intensidad y proyección.
6. Género o preferencia de fragancia.

PRIORIZACIÓN:

- Identifica las características que el usuario
  considera más importantes.

- Si el usuario utiliza expresiones como
  "principalmente", "lo más importante",
  "sobre todo", "priorizo" o "indispensable",
  da mayor importancia a esa característica.

- Si solicita máxima duración, prioriza perfumes
  conocidos por su buena permanencia en la piel.

- Si solicita frescura, prioriza fragancias frescas.

- Si solicita aromas dulces, prioriza perfumes
  con perfiles dulces.

- Si solicita elegancia, considera fragancias
  adecuadas para ocasiones formales.

- Si solicita varias características, busca
  el mejor equilibrio entre ellas.

- No priorices automáticamente la duración
  cuando el usuario no la solicite.

ORDEN DEL TOP:

TOP 1:
El perfume que mejor cumple las preferencias
y prioridades expresadas por el usuario.

TOP 2:
La segunda opción más compatible.

TOP 3:
La tercera opción más compatible.

TOP 4:
La cuarta opción más compatible.

CANTIDAD DE RECOMENDACIONES:

- Recomienda un máximo de 4 perfumes.
- Si existen 4 opciones adecuadas, recomienda 4.
- Si solamente existen 3, recomienda 3.
- Si solamente existen 2, recomienda 2.
- Si existe una sola opción, recomienda 1.
- No inventes perfumes para completar el TOP 4.

FORMATO OBLIGATORIO:

PERFUME 1: Nombre del perfume y marca
TIPO: Familia olfativa y características
OCASIÓN: Situaciones recomendadas
DURACIÓN: Duración aproximada, si se conoce
MOTIVO: Explica por qué cumple las prioridades del usuario

Repite el mismo formato para PERFUME 2,
PERFUME 3 y PERFUME 4 cuando corresponda.

REGLAS ADICIONALES:

- Responde siempre en español.
- Utiliza nombres de perfumes reales.
- No inventes características.
- No inventes disponibilidad.
- No incluyas precios.
- No utilices Markdown.
- No utilices asteriscos.
- No utilices listas con guiones.
- No repitas perfumes.
- No asegures duraciones exactas.
- Ordena siempre por compatibilidad con el cliente.
- Si una recomendación cumple menos requisitos
  que otra, no debe ocupar una posición superior
  sin una razón clara.
- Explica brevemente en MOTIVO qué preferencias
  del usuario cumple cada perfume.
- No agregues introducciones ni despedidas.
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

// Identificar al usuario que realizó la consulta.
// Las consultas del administrador quedan sin usuario asignado.
const usuarioId = req.session?.administrador === true
  ? null
  : req.session.usuarioId;

db.run(`
  INSERT INTO historial (consulta, respuesta, usuario_id)
  VALUES (?, ?, ?)
`, [consulta.trim(), recomendacion, usuarioId], function(error) {
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
// ==========================================
// HISTORIAL DE RECOMENDACIONES POR USUARIO
// ==========================================

app.get("/api/historial", (req, res) => {

  const esAdmin = req.session?.administrador === true;
  const usuarioId = req.session?.usuarioId;

  // Verificar que exista una sesión válida.
  if (!esAdmin && !usuarioId) {
    return res.status(401).json({
      error: "Debes iniciar sesión para consultar el historial."
    });
  }

  // El administrador puede consultar el historial general.
  // Cada usuario únicamente puede consultar sus recomendaciones.
  const sql = esAdmin
    ? `SELECT id, fecha, consulta, respuesta
       FROM historial
       ORDER BY id DESC`
    : `SELECT id, fecha, consulta, respuesta
       FROM historial
       WHERE usuario_id = ?
       ORDER BY id DESC`;

  const parametros = esAdmin ? [] : [usuarioId];

  db.all(sql, parametros, (error, filas) => {

    if (error) {
      console.error("Error al consultar historial:", error.message);

      return res.status(500).json({
        error: "No fue posible consultar el historial."
      });
    }

    res.json({
      historial: filas
    });
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
