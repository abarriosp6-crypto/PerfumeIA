
/* ==========================================
   PERFUMEIA - SCRIPT PRINCIPAL
========================================== */

// ELEMENTOS DE LA INTERFAZ

const consulta = document.getElementById("consulta");
const contador = document.getElementById("contador");
const btnRecomendar = document.getElementById("btnRecomendar");
const cargando = document.getElementById("cargando");
const resultado = document.getElementById("resultado");
const respuestaIA = document.getElementById("respuestaIA");

const btnInicio = document.getElementById("btnInicio");
const btnNuevaConsulta = document.getElementById("btnNuevaConsulta");

const btnCatalogo = document.getElementById("btnCatalogo");
const catalogo = document.getElementById("catalogo");
const listaCatalogo = document.getElementById("listaCatalogo");
const buscarPerfume = document.getElementById("buscarPerfume");
const btnCerrarCatalogo = document.getElementById("btnCerrarCatalogo");

const btnHistorial = document.getElementById("btnHistorial");
const historial = document.getElementById("historial");
const listaHistorial = document.getElementById("listaHistorial");
const btnCerrarHistorial = document.getElementById("btnCerrarHistorial");

const btnAdministracion = document.getElementById("btnAdministracion");
const administracion = document.getElementById("administracion");
const btnCerrarAdministracion =
  document.getElementById("btnCerrarAdministracion");

const listaAdminPerfumes =
  document.getElementById("listaAdminPerfumes");

const formPerfume = document.getElementById("formPerfume");
const btnGuardarPerfume =
  document.getElementById("btnGuardarPerfume");

const mensajeAdmin = document.getElementById("mensajeAdmin");


 // ==========================================
 // INICIO DE SESIÓN Y REGISTRO
 // ==========================================

const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const loginAdmin = document.getElementById("loginAdmin");
const btnCerrarLogin = document.getElementById("btnCerrarLogin");

const formLoginUsuario = document.getElementById("formLoginUsuario");
const formRegistro = document.getElementById("formRegistro");

const panelLogin = document.getElementById("panelLogin");
const panelRegistro = document.getElementById("panelRegistro");

const btnMostrarRegistro = document.getElementById("btnMostrarRegistro");
const btnMostrarLogin = document.getElementById("btnMostrarLogin");

const correoLogin = document.getElementById("correoLogin");
const passwordLogin = document.getElementById("passwordLogin");
const btnIngresar = document.getElementById("btnIngresar");
const mensajeLogin = document.getElementById("mensajeLogin");

const nombreRegistro = document.getElementById("nombreRegistro");
const correoRegistro = document.getElementById("correoRegistro");
const passwordRegistro = document.getElementById("passwordRegistro");
const confirmarPasswordRegistro =
  document.getElementById("confirmarPasswordRegistro");
const btnRegistrar = document.getElementById("btnRegistrar");
const mensajeRegistro = document.getElementById("mensajeRegistro");

const passwordAdmin = document.getElementById("passwordAdmin");
const btnIngresarAdmin = document.getElementById("btnIngresarAdmin");
const mensajeLoginAdmin = document.getElementById("mensajeLoginAdmin");



 // VARIABLES

let perfumes = [];
let esAdministrador = false;
let usuarioActual = null;


/* ==========================================
   FUNCIONES GENERALES
========================================== */

function escapeHTML(texto) {
  const div = document.createElement("div");
  div.textContent = String(texto ?? "");
  return div.innerHTML;
}

function ocultarSecciones() {
  [
    resultado,
    historial,
    catalogo,
    administracion,
    loginAdmin,
    cargando
  ].forEach(seccion => {
    seccion.classList.add("oculto");
  });
}

function activarMenu(boton) {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.remove("active");
  });

  if (boton) {
    boton.classList.add("active");
  }
}

function mostrarSeccion(seccion, boton) {
  ocultarSecciones();

  // Ocultar la pantalla principal al abrir otro apartado
  document.body.classList.add("vista-secundaria");

  seccion.classList.remove("oculto");
  activarMenu(boton);

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function volverInicio() {
  ocultarSecciones();

  // Volver a mostrar la pantalla principal
  document.body.classList.remove("vista-secundaria");

  activarMenu(btnInicio);

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* ==========================================
   ACTUALIZAR MENÚ SEGÚN LA SESIÓN
========================================== */

function actualizarMenuAdmin() {
  const esUsuario = Boolean(usuarioActual) && !esAdministrador;
  const sesionActiva = esAdministrador || esUsuario;

  // El historial estará disponible para usuarios y administradores
  btnHistorial.classList.toggle("oculto", !sesionActiva);

  // Administración continúa siendo exclusiva del administrador
  btnAdministracion.classList.toggle("oculto", !esAdministrador);

  // Mostrar cerrar sesión cuando corresponda
  btnLogout.classList.toggle("oculto", !sesionActiva);

  // Ocultar iniciar sesión cuando ya existe una sesión
  btnLogin.classList.toggle("oculto", sesionActiva);
}

function mostrarError(error) {
  console.error(error);
  return error.message || "Ocurrió un error inesperado.";
}

async function leerJSON(respuesta) {
  const datos = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(datos.error || "La solicitud no pudo completarse.");
  }

  return datos;
}

/* ==========================================
   VERIFICAR SESIÓN
========================================== */

async function verificarSesion() {
  try {
    const respuesta = await fetch("/api/usuarios/sesion", {
      credentials: "same-origin",
      cache: "no-store"
    });

    const datos = await leerJSON(respuesta);

    // Reiniciar el estado antes de comprobar la sesión
    esAdministrador = false;
    usuarioActual = null;

    if (datos.autenticado === true) {

      // Sesión del administrador
      if (datos.rol === "administrador") {
        esAdministrador = true;
      }

      // Sesión de usuario normal
      else if (
        datos.rol === "usuario" ||
        datos.usuario?.rol === "usuario"
      ) {
        usuarioActual = datos.usuario;
      }
    }

  } catch (error) {
    console.error("No se pudo verificar la sesión:", error);

    esAdministrador = false;
    usuarioActual = null;
  }

  actualizarMenuAdmin();
}

/* ==========================================
   ABRIR INICIO DE SESIÓN
========================================== */

btnLogin.addEventListener("click", () => {
  mensajeLogin.textContent = "";
  mensajeLoginAdmin.textContent = "";

  passwordAdmin.value = "";

  // Mostrar primero el formulario de usuarios
  panelRegistro.classList.add("oculto");
  panelLogin.classList.remove("oculto");
panelNuevaPassword.classList.add("oculto");
panelLogin.classList.remove("oculto");
  document.getElementById("tituloAcceso").textContent =
    "Iniciar sesión";

  document.getElementById("descripcionAcceso").textContent =
    "Ingresa con tu cuenta para utilizar las recomendaciones de IA.";

  mostrarSeccion(loginAdmin, btnLogin);

  correoLogin.focus();
});

btnCerrarLogin.addEventListener("click", volverInicio);

/* ==========================================
   INICIAR SESIÓN
========================================== */


btnIngresarAdmin.addEventListener("click", async () => {
  const password = passwordAdmin.value;

  if (!password) {
    mensajeLoginAdmin.textContent = "Escribe tu contraseña.";
    return;
  }

  btnIngresarAdmin.disabled = true;
  btnIngresarAdmin.textContent = "Verificando...";
  mensajeLoginAdmin.textContent = "";

  try {
    const respuesta = await fetch("/api/admin/login", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password })
    });

    await leerJSON(respuesta);

    esAdministrador = true;
    actualizarMenuAdmin();

    passwordAdmin.value = "";
    mensajeLoginAdmin.textContent = "";

    mostrarSeccion(administracion, btnAdministracion);
    await cargarCatalogo();

  } catch (error) {
    esAdministrador = false;
    actualizarMenuAdmin();

    mensajeLoginAdmin.textContent = mostrarError(error);
    passwordAdmin.value = "";
    passwordAdmin.focus();

  } finally {
    btnIngresarAdmin.disabled = false;
    btnIngresarAdmin.textContent = "Acceder como administrador";
  }
});



formLoginUsuario.addEventListener("submit", async evento => {
  evento.preventDefault();

  const correo = correoLogin.value.trim();
  const password = passwordLogin.value;

  mensajeLogin.textContent = "";
  btnIngresar.disabled = true;
  btnIngresar.textContent = "Verificando...";

  try {
    const respuesta = await fetch("/api/usuarios/login", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ correo, password })
    });

    const datos = await leerJSON(respuesta);

    // Guardar el usuario autenticado
    usuarioActual = datos.usuario;
    esAdministrador = false;

    // Actualizar la interfaz
    actualizarMenuAdmin();
    passwordLogin.value = "";
    loginAdmin.classList.add("oculto");

    mensajeLogin.textContent =
      `Bienvenido, ${usuarioActual.nombre}.`;

    volverInicio();

  } catch (error) {
    mensajeLogin.textContent = mostrarError(error);
    passwordLogin.value = "";
    passwordLogin.focus();

  } finally {
    btnIngresar.disabled = false;
    btnIngresar.textContent = "Iniciar sesión";
  }
});



/* ==========================================
   CERRAR SESIÓN
========================================== */

btnLogout.addEventListener("click", async () => {
  try {
    const rutaLogout = esAdministrador
      ? "/api/admin/logout"
      : "/api/usuarios/logout";

    const respuesta = await fetch(rutaLogout, {
      method: "POST",
      credentials: "same-origin"
    });

    await leerJSON(respuesta);

    esAdministrador = false;
    usuarioActual = null;

    actualizarMenuAdmin();

    if (listaHistorial) {
      listaHistorial.innerHTML = "";
    }

    if (listaAdminPerfumes) {
      listaAdminPerfumes.innerHTML = "";
    }

    if (passwordAdmin) {
      passwordAdmin.value = "";
    }

    if (passwordLogin) {
      passwordLogin.value = "";
    }

    if (loginAdmin) {
      loginAdmin.classList.add("oculto");
    }

    volverInicio();

    alert("Sesión cerrada correctamente.");

  } catch (error) {
    alert(mostrarError(error));
  }
});


/* ==========================================
   CATÁLOGO DESDE SQLITE
========================================== */

async function cargarCatalogo() {
  try {
    listaCatalogo.innerHTML = "<p>Cargando perfumes...</p>";

    const respuesta = await fetch("/api/perfumes", {
      cache: "no-store"
    });

    const datos = await leerJSON(respuesta);

    if (!Array.isArray(datos)) {
      throw new Error("El catálogo tiene un formato incorrecto.");
    }

perfumes = datos.map(perfume => ({
  id: perfume.id,
  nombre: perfume.nombre,
  marca: perfume.marca,
  descripcion: perfume.descripcion,
  tipo: perfume.tipo_aroma,
  genero: perfume.genero || "Unisex",
  disponible: Number(perfume.disponible) === 1
}));

    filtrarCatalogo();

    if (esAdministrador) {
      mostrarAdminPerfumes();
    }

    console.log("Perfumes cargados:", perfumes.length);

  } catch (error) {
    mostrarError(error);

    listaCatalogo.innerHTML =
      "<p>No fue posible cargar el catálogo.</p>";

    if (esAdministrador) {
      listaAdminPerfumes.innerHTML =
        "<p>No fue posible cargar los perfumes.</p>";
    }
  }
}

/* ==========================================
   MOSTRAR CATÁLOGO DE PERFUMES
========================================== */

async function mostrarCatalogo(lista = perfumes) {
  listaCatalogo.innerHTML = "";

  if (lista.length === 0) {
    listaCatalogo.innerHTML =
      "<p>No encontramos perfumes con ese nombre o marca.</p>";
    return;
  }

  const fragmento = document.createDocumentFragment();

  for (const perfume of lista) {
    const tarjeta = document.createElement("div");
    tarjeta.className = "perfume-card";

    let textoPresentaciones = "Sin presentaciones registradas";

    try {
      const respuesta = await fetch(
        `/api/perfumes/${encodeURIComponent(perfume.id)}/presentaciones`,
        {
          credentials: "same-origin"
        }
      );

      if (!respuesta.ok) {
        throw new Error("Error al consultar las presentaciones");
      }

      const datos = await respuesta.json();

      const presentaciones = Array.isArray(datos)
        ? datos
        : datos.presentaciones || [];

      if (presentaciones.length > 0) {
        textoPresentaciones = presentaciones
          .map(p => `${Number(p.mililitros)} ml`)
          .join(" · ");
      }

    } catch (error) {
      console.error(
        `Error al cargar presentaciones del perfume ${perfume.id}:`,
        error
      );

      textoPresentaciones = "No se pudieron cargar";
    }

    tarjeta.innerHTML = `
      <h3>${escapeHTML(perfume.nombre)}</h3>

      <p class="perfume-marca">
        ${escapeHTML(perfume.marca)}
      </p>

      <p class="perfume-descripcion">
        ${escapeHTML(perfume.descripcion)}
      </p>

      <span class="perfume-tipo">
        ${escapeHTML(perfume.tipo || perfume.tipo_aroma || "")}
      </span>

      <p class="perfume-presentaciones">
        <strong>Presentaciones:</strong>
        ${escapeHTML(textoPresentaciones)}
      </p>

      <span class="perfume-disponible">
        ${perfume.disponible ? "✓ Disponible" : "No disponible"}
      </span>
    `;

    fragmento.appendChild(tarjeta);
  }

  listaCatalogo.appendChild(fragmento);
}

function filtrarCatalogo() {
  const busqueda = buscarPerfume.value
    .trim()
    .toLocaleLowerCase("es");

  const filtrados = perfumes.filter(perfume => {
    const nombre = String(perfume.nombre).toLocaleLowerCase("es");
    const marca = String(perfume.marca).toLocaleLowerCase("es");

    return nombre.includes(busqueda) ||
           marca.includes(busqueda);
  });

  mostrarCatalogo(filtrados);
}

buscarPerfume.addEventListener("input", filtrarCatalogo);


/* ==========================================
   LISTADO ADMINISTRATIVO
========================================== */

const idPerfume = document.getElementById("idPerfume");
const nombrePerfume = document.getElementById("nombrePerfume");
const marcaPerfume = document.getElementById("marcaPerfume");
const tipoPerfume = document.getElementById("tipoPerfume");
const generoPerfume = document.getElementById("generoPerfume");
const disponiblePerfume = document.getElementById("disponiblePerfume");
const descripcionPerfume = document.getElementById("descripcionPerfume");
const btnCancelarEdicion = document.getElementById("btnCancelarEdicion");
const tituloFormularioPerfume = document.getElementById("tituloFormularioPerfume");

let guardandoPerfume = false;

/* ==========================================
   MOSTRAR PERFUMES EN ADMINISTRACIÓN
========================================== */

async function mostrarAdminPerfumes() {
  listaAdminPerfumes.innerHTML = "";

  if (!esAdministrador) {
    return;
  }

  if (perfumes.length === 0) {
    listaAdminPerfumes.innerHTML =
      "<p>No hay perfumes registrados.</p>";
    return;
  }

  for (const perfume of perfumes) {
    const elemento = document.createElement("div");
    elemento.className = "admin-perfume-item";

    let textoPresentaciones = "Sin presentaciones registradas";

    try {
      const respuesta = await fetch(
        `/api/perfumes/${encodeURIComponent(perfume.id)}/presentaciones`,
        { credentials: "same-origin" }
      );

      if (!respuesta.ok) {
        throw new Error("No se pudieron consultar las presentaciones");
      }

      const datos = await respuesta.json();

      const presentaciones = Array.isArray(datos)
        ? datos
        : datos.presentaciones || [];

      if (presentaciones.length > 0) {
        textoPresentaciones = presentaciones
          .map(p => `${Number(p.mililitros)} ml`)
          .join(" · ");
      }

    } catch (error) {
      console.error(
        `Error al cargar presentaciones del perfume ${perfume.id}:`,
        error
      );

      textoPresentaciones = "No se pudieron cargar";
    }

    elemento.innerHTML = `
      <div class="admin-perfume-info">
        <h4>${escapeHTML(perfume.nombre)}</h4>

        <p>
          <strong>Marca:</strong>
          ${escapeHTML(perfume.marca)}
        </p>

        <p>
          <strong>Tipo:</strong>
          ${escapeHTML(perfume.tipo || perfume.tipo_aroma || "")}
        </p>

        <p>
          <strong>Estado:</strong>
          ${perfume.disponible ? "Disponible" : "No disponible"}
        </p>

        <p>
          <strong>Presentaciones:</strong>
          ${escapeHTML(textoPresentaciones)}
        </p>
      </div>

      <div class="admin-acciones">
        <button
          class="admin-btn-editar"
          type="button"
        >
          Editar
        </button>

        <button
          class="admin-btn-eliminar"
          type="button"
        >
          Eliminar
        </button>
      </div>
    `;

    elemento.querySelector(".admin-btn-editar")
      .addEventListener("click", () => {
        editarPerfume(perfume.id);
      });

    elemento.querySelector(".admin-btn-eliminar")
      .addEventListener("click", () => {
        eliminarPerfume(perfume.id);
      });

    listaAdminPerfumes.appendChild(elemento);
  }
}

/* ==========================================
   REINICIAR FORMULARIO
========================================== */

function limpiarFormularioPerfume() {
  formPerfume.reset();
  idPerfume.value = "";
  disponiblePerfume.value = "1";

  tituloFormularioPerfume.textContent =
    "Registrar un perfume";

  btnGuardarPerfume.textContent =
    "Guardar perfume";

  btnCancelarEdicion.classList.add("oculto");
}

/* ==========================================
   REGISTRAR Y ACTUALIZAR PERFUMES
========================================== */

btnGuardarPerfume.disabled = false;
mensajeAdmin.textContent = "";

formPerfume.addEventListener("submit", async evento => {
  evento.preventDefault();

  if (!esAdministrador || guardandoPerfume) {
    return;
  }

  const nombre = nombrePerfume.value.trim();
  const marca = marcaPerfume.value.trim();
  const tipo_aroma = tipoPerfume.value.trim();
  const descripcion = descripcionPerfume.value.trim();

  if (!nombre || !marca || !tipo_aroma || !descripcion) {
    mensajeAdmin.textContent =
      "Completa todos los campos obligatorios.";
    return;
  }

  // Validar las presentaciones agregadas
  const presentaciones = [...presentacionesSeleccionadas]
    .sort((a, b) => a - b);

  if (presentaciones.length === 0) {
    mensajeAdmin.textContent =
      "Agrega al menos una presentación en mililitros.";
    return;
  }

const datosPerfume = {
  nombre,
  marca,
  tipo_aroma,
  descripcion,
  genero: generoPerfume.value,
  disponible: Number(disponiblePerfume.value),
  presentaciones: [...presentacionesSeleccionadas]
};

  const id = idPerfume.value;
  const editando = id !== "";

  const url = editando
    ? `/api/admin/perfumes/${encodeURIComponent(id)}`
    : "/api/admin/perfumes";

  const metodo = editando ? "PUT" : "POST";

  guardandoPerfume = true;
  btnGuardarPerfume.disabled = true;

  btnGuardarPerfume.textContent = editando
    ? "Actualizando..."
    : "Guardando...";

  mensajeAdmin.textContent = "";

  try {
    const respuesta = await fetch(url, {
      method: metodo,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(datosPerfume)
    });

    if (respuesta.status === 401) {
      esAdministrador = false;
      actualizarMenuAdmin();
      limpiarFormularioPerfume();
      volverInicio();
      alert("Tu sesión terminó. Inicia sesión nuevamente.");
      return;
    }

    const datos = await leerJSON(respuesta);

    // Verificar que el servidor aceptó la operación
    if (!respuesta.ok) {
      throw new Error(
        datos.error ||
        datos.mensaje ||
        "No se pudo guardar el perfume."
      );
    }

    limpiarFormularioPerfume();

    // Limpiar las presentaciones después de guardar
    presentacionesSeleccionadas = [];
    mostrarPresentaciones();
    inputNuevaPresentacion.value = "";
    mensajePresentaciones.textContent = "";

    await cargarCatalogo();

    mensajeAdmin.textContent =
      datos.mensaje || "Operación realizada correctamente.";

  } catch (error) {
    mensajeAdmin.textContent = mostrarError(error);

  } finally {
    guardandoPerfume = false;
    btnGuardarPerfume.disabled = false;

    btnGuardarPerfume.textContent =
      idPerfume.value
        ? "Actualizar perfume"
        : "Guardar perfume";
  }
});
/* ==========================================
   EDITAR PERFUME CON PRESENTACIONES EN ML
========================================== */

async function editarPerfume(id) {
  if (!esAdministrador) {
    return;
  }

  const perfume = perfumes.find(item =>
    Number(item.id) === Number(id)
  );

  if (!perfume) {
    mensajeAdmin.textContent = "No se encontró el perfume.";
    return;
  }

  // Cargar los datos generales del perfume
  idPerfume.value = perfume.id;
  nombrePerfume.value = perfume.nombre;
  marcaPerfume.value = perfume.marca;
  tipoPerfume.value = perfume.tipo_aroma || perfume.tipo || "";
  descripcionPerfume.value = perfume.descripcion;

  disponiblePerfume.value =
    perfume.disponible ? "1" : "0";

  generoPerfume.value = perfume.genero || "Unisex";

  // Cargar las presentaciones desde SQLite
  try {
    const respuesta = await fetch(
      `/api/perfumes/${encodeURIComponent(id)}/presentaciones`,
      { credentials: "same-origin" }
    );

    if (!respuesta.ok) {
      throw new Error("No se pudieron cargar las presentaciones.");
    }

    const datos = await respuesta.json();

    presentacionesSeleccionadas = datos.presentaciones.map(
      item => Number(item.mililitros)
    );

    mostrarPresentaciones();

    inputNuevaPresentacion.value = "";
    mensajePresentaciones.textContent = "";

  } catch (error) {
    mensajeAdmin.textContent =
      "No se pudieron cargar las presentaciones. Intenta nuevamente.";

    // Evitar editar con una lista incompleta
    idPerfume.value = "";
    presentacionesSeleccionadas = [];
    mostrarPresentaciones();
    return;
  }

  // Preparar el formulario para edición
  tituloFormularioPerfume.textContent = "Editar perfume";

  btnGuardarPerfume.textContent = "Actualizar perfume";

  btnCancelarEdicion.classList.remove("oculto");

  mensajeAdmin.textContent =
    "Modifica los datos y presiona Actualizar perfume.";

  formPerfume.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

/* ==========================================
   CANCELAR EDICIÓN
========================================== */

btnCancelarEdicion.addEventListener("click", () => {
  limpiarFormularioPerfume();
  mensajeAdmin.textContent = "";
});

/* ==========================================
   ELIMINAR PERFUME
========================================== */

async function eliminarPerfume(id) {
  if (!esAdministrador || guardandoPerfume) {
    return;
  }

  const perfume = perfumes.find(item =>
    Number(item.id) === Number(id)
  );

  if (!perfume) {
    alert("No se encontró el perfume.");
    return;
  }

  const confirmar = confirm(
    `¿Estás seguro de eliminar "${perfume.nombre}"?\n\nEsta acción no se puede deshacer.`
  );

  if (!confirmar) {
    return;
  }

  guardandoPerfume = true;
  mensajeAdmin.textContent = "Eliminando perfume...";

  try {
    const respuesta = await fetch(
      `/api/admin/perfumes/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        credentials: "same-origin"
      }
    );

    if (respuesta.status === 401) {
      esAdministrador = false;
      actualizarMenuAdmin();
      limpiarFormularioPerfume();
      volverInicio();
      alert("Tu sesión terminó. Inicia sesión nuevamente.");
      return;
    }

    const datos = await leerJSON(respuesta);

    if (Number(idPerfume.value) === Number(id)) {
      limpiarFormularioPerfume();
    }

    await cargarCatalogo();

    mensajeAdmin.textContent =
      datos.mensaje || "Perfume eliminado correctamente.";

  } catch (error) {
    mensajeAdmin.textContent = mostrarError(error);

  } finally {
    guardandoPerfume = false;
  }
}

/* ==========================================
   ABRIR ADMINISTRACIÓN
========================================== */

btnAdministracion.addEventListener("click", async () => {
  if (!esAdministrador) {
    return;
  }

  mostrarSeccion(administracion, btnAdministracion);
  await cargarCatalogo();
});

btnCerrarAdministracion.addEventListener(
  "click",
  volverInicio
);


/* ==========================================
   NAVEGACIÓN
========================================== */

btnInicio.addEventListener("click", volverInicio);

btnNuevaConsulta.addEventListener("click", () => {
  volverInicio();
  activarMenu(btnNuevaConsulta);
  consulta.focus();
});

btnCatalogo.addEventListener("click", async () => {
  buscarPerfume.value = "";

  mostrarSeccion(catalogo, btnCatalogo);
  await cargarCatalogo();
});

btnCerrarCatalogo.addEventListener("click", volverInicio);

btnCerrarHistorial.addEventListener("click", volverInicio);

/* ==========================================
   CONTADOR DE CARACTERES
========================================== */

consulta.addEventListener("input", () => {
  contador.textContent = `${consulta.value.length} / 500`;
});

/* ==========================================
   EJEMPLOS DE CONSULTAS
========================================== */

document.querySelectorAll(".chip").forEach(boton => {
  boton.addEventListener("click", () => {
    const opciones = {
      "Fresco y cítrico":
        "Busco un perfume fresco y cítrico para utilizar todos los días.",

      "Elegante para la noche":
        "Busco un perfume elegante y sofisticado para utilizar de noche.",

      "Dulce y femenino":
        "Busco un perfume dulce y femenino para ocasiones especiales.",

      "Para clima caluroso":
        "Busco un perfume fresco para utilizar en clima caluroso."
    };

    const texto = opciones[boton.textContent.trim()];

    if (texto) {
      consulta.value = texto;
      contador.textContent = `${texto.length} / 500`;
      consulta.focus();
    }
  });
});

/* ==========================================
// FORMATO DE RECOMENDACIONES - TOP 4
// ==========================================*/

function formatearRespuesta(texto) {
  const lineas = String(texto ?? "")
    .split("\n")
    .map(linea => linea.trim())
    .filter(Boolean);

  const perfumes = [];
  let perfumeActual = null;

  lineas.forEach(linea => {
    const limpia = linea
      .replace(/\*\*/g, "")
      .replace(/^[-•]\s*/, "")
      .trim();

    // Reconocer PERFUME 1, 2, 3 o 4
    const nombre = limpia.match(
      /^(?:PERFUME|TOP)\s*([1-4])\s*[:.)—-]\s*(.+)$/i
    );

    if (nombre) {
      perfumeActual = {
        numero: Number(nombre[1]),
        nombre: nombre[2].trim(),
        tipo: "",
        ocasion: "",
        duracion: "",
        motivo: ""
      };

      perfumes.push(perfumeActual);
      return;
    }

    if (!perfumeActual) return;

    const detalle = limpia.match(
      /^(TIPO|Tipo de aroma|OCASI[ÓO]N|DURACI[ÓO]N|MOTIVO)\s*:\s*(.+)$/i
    );

    if (!detalle) return;

    const campo = detalle[1].toUpperCase();
    const valor = detalle[2].trim();

    if (campo === "TIPO" || campo === "TIPO DE AROMA") {
      perfumeActual.tipo = valor;
    } else if (campo === "OCASIÓN" || campo === "OCASION") {
      perfumeActual.ocasion = valor;
    } else if (campo === "DURACIÓN" || campo === "DURACION") {
      perfumeActual.duracion = valor;
    } else if (campo === "MOTIVO") {
      perfumeActual.motivo = valor;
    }
  });

  if (perfumes.length === 0) {
    return `
      <p class="sin-recomendaciones">
        ${escapeHTML(String(texto || "No se encontraron recomendaciones."))}
      </p>
    `;
  }

  return `
    <div class="contenedor-recomendaciones">
      ${perfumes.slice(0, 4).map((perfume, indice) => `
        <article class="tarjeta-recomendacion">

          <div class="encabezado-recomendacion">
            <span class="numero-recomendacion">
              TOP ${indice + 1}
            </span>

            <h3>${escapeHTML(perfume.nombre)}</h3>
          </div>

          <div class="contenido-recomendacion">

            ${perfume.tipo ? `
              <p>
                <strong>🌸 Tipo de aroma:</strong>
                ${escapeHTML(perfume.tipo)}
              </p>
            ` : ""}

            ${perfume.ocasion ? `
              <p>
                <strong>📅 Ocasión:</strong>
                ${escapeHTML(perfume.ocasion)}
              </p>
            ` : ""}

            ${perfume.duracion ? `
              <p>
                <strong>⏱️ Duración:</strong>
                ${escapeHTML(perfume.duracion)}
              </p>
            ` : ""}

            ${perfume.motivo ? `
              <p>
                <strong>✨ ¿Por qué lo recomendamos?</strong>
                ${escapeHTML(perfume.motivo)}
              </p>
            ` : ""}

          </div>
        </article>
      `).join("")}
    </div>
  `;
}

/* ==========================================
   RECOMENDACIONES CON GROQ
========================================== */

btnRecomendar.addEventListener("click", async () => {
  const texto = consulta.value.trim();

  if (texto.length < 10 || texto.length > 500) {
    alert("Escribe una descripción de entre 10 y 500 caracteres.");
    return;
  }

  ocultarSecciones();
  cargando.classList.remove("oculto");

  btnRecomendar.disabled = true;
  activarMenu(btnNuevaConsulta);

  try {
    const respuesta = await fetch("/api/recomendar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        consulta: texto
      })
    });

    const datos = await leerJSON(respuesta);

    respuestaIA.innerHTML =
      formatearRespuesta(datos.recomendacion);

    cargando.classList.add("oculto");
    resultado.classList.remove("oculto");

    resultado.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  } catch (error) {
    cargando.classList.add("oculto");
    alert(mostrarError(error));

  } finally {
    btnRecomendar.disabled = false;
  }
});

/* ==========================================
   HISTORIAL DE RECOMENDACIONES
========================================== */

btnHistorial.addEventListener("click", async () => {

  // Verificar que exista una sesión activa
  if (!esAdministrador && !usuarioActual) {
    alert("Debes iniciar sesión para consultar tu historial.");
    return;
  }

  mostrarSeccion(historial, btnHistorial);

  listaHistorial.innerHTML = "<p>Cargando historial...</p>";

  try {
    const respuesta = await fetch("/api/historial", {
      credentials: "same-origin",
      cache: "no-store"
    });

    if (respuesta.status === 401) {
      esAdministrador = false;
      usuarioActual = null;

      actualizarMenuAdmin();
      volverInicio();

      alert("Tu sesión terminó. Inicia sesión nuevamente.");
      return;
    }

    const datos = await leerJSON(respuesta);

    // Obtener las recomendaciones del servidor
    const registros = datos.historial;

    if (!Array.isArray(registros)) {
      throw new Error("El historial tiene un formato incorrecto.");
    }

    listaHistorial.innerHTML = "";

    if (registros.length === 0) {
      listaHistorial.innerHTML =
        "<p>Todavía no tienes recomendaciones guardadas.</p>";
      return;
    }

registros.forEach(registro => {

  const elemento = document.createElement("div");
  elemento.className = "historial-item";

  const fecha = new Date(registro.fecha);

  const fechaTexto = Number.isNaN(fecha.getTime())
    ? String(registro.fecha ?? "")
    : fecha.toLocaleString("es-GT");

  const consultaCompleta = String(registro.consulta ?? "");

  const consultaResumida =
    consultaCompleta.length > 90
      ? consultaCompleta.substring(0, 90) + "..."
      : consultaCompleta;

  elemento.innerHTML = `
    <div class="historial-resumen">

      <div class="historial-info">

        <small>
          Consulta #${escapeHTML(registro.id)}
          · ${escapeHTML(fechaTexto)}
        </small>

        <h3>${escapeHTML(consultaResumida)}</h3>

      </div>

      <button
        type="button"
        class="btn-ver-detalles"
        aria-expanded="false"
      >
        Ver detalles ▼
      </button>

    </div>

    <div class="historial-detalles oculto">

      <p>
        <strong>Consulta realizada:</strong>
        ${escapeHTML(consultaCompleta)}
      </p>

      <div class="respuesta-historial">
        ${formatearRespuesta(registro.respuesta)}
      </div>

    </div>
  `;

  const btnDetalles =
    elemento.querySelector(".btn-ver-detalles");

  const detalles =
    elemento.querySelector(".historial-detalles");

  btnDetalles.addEventListener("click", () => {

    const abierto = !detalles.classList.contains("oculto");

    detalles.classList.toggle("oculto", abierto);

    btnDetalles.textContent = abierto
      ? "Ver detalles ▼"
      : "Ocultar detalles ▲";

    btnDetalles.setAttribute(
      "aria-expanded",
      String(!abierto)
    );

  });

  listaHistorial.appendChild(elemento);

});

  } catch (error) {
    listaHistorial.innerHTML = `
      <p>${escapeHTML(mostrarError(error))}</p>
    `;
  }
});

/* ==========================================
   INICIALIZAR PERFUMEIA
========================================== */

async function iniciarPerfumeIA() {
  await verificarSesion();
  await cargarCatalogo();

  console.log("PerfumeIA preparada correctamente.");
}

iniciarPerfumeIA();

/* ==========================================
   REGISTRO DE USUARIOS
========================================== */

formRegistro.addEventListener("submit", async evento => {
  evento.preventDefault();

  const nombre = nombreRegistro.value.trim();
  const correo = correoRegistro.value.trim();
  const password = passwordRegistro.value;
const confirmacion = confirmarPasswordRegistro.value;

// Verificar que ambas contraseñas coincidan
if (password !== confirmacion) {
  mensajeRegistro.textContent =
    "Las contraseñas no coinciden. Verifica e intenta nuevamente.";

  confirmarPasswordRegistro.focus();
  return;
}
  mensajeRegistro.textContent = "";
  btnRegistrar.disabled = true;
  btnRegistrar.textContent = "Registrando...";

  try {
    const respuesta = await fetch("/api/usuarios/registro", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ nombre, correo, password })
    });

    await leerJSON(respuesta);

    mensajeRegistro.textContent =
      "Cuenta creada correctamente. Ya puedes iniciar sesión.";

    formRegistro.reset();
    panelRegistro.classList.add("oculto");
    panelLogin.classList.remove("oculto");

    document.getElementById("tituloAcceso").textContent =
      "Iniciar sesión";

    document.getElementById("descripcionAcceso").textContent =
      "Ingresa con tu cuenta para utilizar las recomendaciones de IA.";

  } catch (error) {
    mensajeRegistro.textContent = mostrarError(error);

  } finally {
    btnRegistrar.disabled = false;
    btnRegistrar.textContent = "Crear cuenta";
  }
});

/* MOSTRAR REGISTRO */

btnMostrarRegistro.addEventListener("click", () => {

  panelLogin.classList.add("oculto");
  panelRecuperacion.classList.add("oculto");
  panelNuevaPassword.classList.add("oculto");

  panelRegistro.classList.remove("oculto");

  document.getElementById("tituloAcceso").textContent =
    "Crear cuenta";

  document.getElementById("descripcionAcceso").textContent =
    "Regístrate para utilizar las recomendaciones de PerfumeIA.";

});

/* VOLVER AL INICIO DE SESIÓN */

btnMostrarLogin.addEventListener("click", () => {

  panelRegistro.classList.add("oculto");
  panelRecuperacion.classList.add("oculto");
  panelNuevaPassword.classList.add("oculto");

  panelLogin.classList.remove("oculto");

  document.getElementById("tituloAcceso").textContent =
    "Iniciar sesión";

  document.getElementById("descripcionAcceso").textContent =
    "Ingresa con tu cuenta para utilizar las recomendaciones de IA.";

});

// ==========================================
// PERFUMEIA - PRESENTACIONES EN MILILITROS
// ==========================================

const inputNuevaPresentacion = document.getElementById("nuevaPresentacion");
const btnAgregarPresentacion = document.getElementById("btnAgregarPresentacion");
const listaPresentaciones = document.getElementById("listaPresentaciones");
const mensajePresentaciones = document.getElementById("mensajePresentaciones");

let presentacionesSeleccionadas = [];

// Mostrar las presentaciones agregadas
function mostrarPresentaciones() {
  listaPresentaciones.innerHTML = "";

  presentacionesSeleccionadas
    .sort((a, b) => a - b)
    .forEach((ml) => {
      const elemento = document.createElement("div");
      elemento.className = "presentacion-item";

      const texto = document.createElement("span");
      texto.textContent = `${ml} ml`;

      const botonEliminar = document.createElement("button");
      botonEliminar.type = "button";
      botonEliminar.textContent = "×";
      botonEliminar.title = `Eliminar presentación de ${ml} ml`;

      botonEliminar.addEventListener("click", () => {
        presentacionesSeleccionadas = presentacionesSeleccionadas.filter(
          (presentacion) => presentacion !== ml
        );

        mostrarPresentaciones();
      });

      elemento.appendChild(texto);
      elemento.appendChild(botonEliminar);

      listaPresentaciones.appendChild(elemento);
    });
}

// Agregar una presentación
btnAgregarPresentacion.addEventListener("click", () => {
  const ml = Number(inputNuevaPresentacion.value);

  mensajePresentaciones.textContent = "";

  if (!Number.isInteger(ml) || ml < 1 || ml > 1000) {
    mensajePresentaciones.textContent =
      "Ingresa una presentación válida entre 1 y 1000 ml.";
    return;
  }

  if (presentacionesSeleccionadas.includes(ml)) {
    mensajePresentaciones.textContent =
      "Esta presentación ya fue agregada.";
    return;
  }

  presentacionesSeleccionadas.push(ml);

  mostrarPresentaciones();

  inputNuevaPresentacion.value = "";
  inputNuevaPresentacion.focus();
});
// ==========================================
// PERFUMEIA - RECUPERACIÓN DE CONTRASEÑAS
// ==========================================

const panelRecuperacion = document.getElementById("panelRecuperacion");
const panelNuevaPassword = document.getElementById("panelNuevaPassword");

const btnMostrarRecuperacion = document.getElementById("btnMostrarRecuperacion");
const btnVolverLogin = document.getElementById("btnVolverLogin");
const btnVolverLoginPassword = document.getElementById("btnVolverLoginPassword");

const formRecuperacion = document.getElementById("formRecuperacion");
const formNuevaPassword = document.getElementById("formNuevaPassword");

const correoRecuperacion = document.getElementById("correoRecuperacion");
const nuevaPassword = document.getElementById("nuevaPassword");
const confirmarNuevaPassword = document.getElementById("confirmarNuevaPassword");

const mensajeRecuperacion = document.getElementById("mensajeRecuperacion");
const mensajeNuevaPassword = document.getElementById("mensajeNuevaPassword");

const btnEnviarRecuperacion = document.getElementById("btnEnviarRecuperacion");
const btnGuardarNuevaPassword = document.getElementById("btnGuardarNuevaPassword");

let tokenRecuperacion = null;

// ==========================================
// MOSTRAR PANELES DE ACCESO
// ==========================================

function mostrarPanelAcceso(panel, titulo, descripcion) {
  panelLogin.classList.add("oculto");
  panelRegistro.classList.add("oculto");
  panelRecuperacion.classList.add("oculto");
  panelNuevaPassword.classList.add("oculto");

  panel.classList.remove("oculto");

  document.getElementById("tituloAcceso").textContent = titulo;
  document.getElementById("descripcionAcceso").textContent = descripcion;

  mostrarSeccion(loginAdmin, btnLogin);
}

// ==========================================
// ABRIR RECUPERACIÓN DE CONTRASEÑA
// ==========================================

btnMostrarRecuperacion.addEventListener("click", () => {
  mensajeRecuperacion.textContent = "";

  mostrarPanelAcceso(
    panelRecuperacion,
    "Recuperar contraseña",
    "Te enviaremos un enlace para recuperar tu cuenta."
  );

  correoRecuperacion.focus();
});

// ==========================================
// VOLVER AL INICIO DE SESIÓN
// ==========================================

function regresarAlLogin() {
  tokenRecuperacion = null;

  formNuevaPassword.reset();

  // Quitar el token de la barra de direcciones.
  const url = new URL(window.location.href);
  url.searchParams.delete("recuperar");

  window.history.replaceState(
    {},
    "",
    url.pathname + url.search + url.hash
  );

  mostrarPanelAcceso(
    panelLogin,
    "Iniciar sesión",
    "Ingresa con tu cuenta para utilizar las recomendaciones de IA."
  );

  correoLogin.focus();
}

btnVolverLogin.addEventListener("click", regresarAlLogin);
btnVolverLoginPassword.addEventListener("click", regresarAlLogin);

// ==========================================
// SOLICITAR ENLACE DE RECUPERACIÓN
// ==========================================

formRecuperacion.addEventListener("submit", async evento => {
  evento.preventDefault();

  const correo = correoRecuperacion.value.trim();

  mensajeRecuperacion.textContent = "";
  btnEnviarRecuperacion.disabled = true;
  btnEnviarRecuperacion.textContent = "Enviando...";

  try {
    const respuesta = await fetch(
      "/api/usuarios/recuperar-password",
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ correo })
      }
    );

    const datos = await leerJSON(respuesta);

    mensajeRecuperacion.textContent = datos.mensaje;

    formRecuperacion.reset();

  } catch (error) {
    mensajeRecuperacion.textContent = mostrarError(error);

  } finally {
    btnEnviarRecuperacion.disabled = false;
    btnEnviarRecuperacion.textContent = "Enviar enlace de recuperación";
  }
});

// ==========================================
// ABRIR ENLACE RECIBIDO POR CORREO
// ==========================================

function comprobarEnlaceRecuperacion() {
  const parametros = new URLSearchParams(window.location.search);
  const token = parametros.get("recuperar");

  if (!token) {
    return;
  }

  // Retirar el token de la URL visible.
  const url = new URL(window.location.href);
  url.searchParams.delete("recuperar");

  window.history.replaceState(
    {},
    "",
    url.pathname + url.search + url.hash
  );

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    mostrarPanelAcceso(
      panelRecuperacion,
      "Enlace inválido",
      "Solicita un nuevo enlace de recuperación."
    );

    mensajeRecuperacion.textContent =
      "El enlace de recuperación no es válido.";

    return;
  }

  tokenRecuperacion = token;

  mostrarPanelAcceso(
    panelNuevaPassword,
    "Nueva contraseña",
    "Establece una nueva contraseña para tu cuenta."
  );

  nuevaPassword.focus();
}

// ==========================================
// GUARDAR NUEVA CONTRASEÑA
// ==========================================

formNuevaPassword.addEventListener("submit", async evento => {
  evento.preventDefault();

  const password = nuevaPassword.value;
  const confirmacion = confirmarNuevaPassword.value;

  mensajeNuevaPassword.textContent = "";

  if (!tokenRecuperacion) {
    mensajeNuevaPassword.textContent =
      "El enlace no es válido. Solicita uno nuevo.";
    return;
  }

  if (password !== confirmacion) {
    mensajeNuevaPassword.textContent =
      "Las contraseñas no coinciden.";
    return;
  }

  if (
    password.length < 10 ||
    BufferByteLength(password) > 72
  ) {
    mensajeNuevaPassword.textContent =
      "La contraseña debe tener al menos 10 caracteres y no superar 72 bytes.";
    return;
  }

  btnGuardarNuevaPassword.disabled = true;
  btnGuardarNuevaPassword.textContent = "Guardando...";

  try {
    const respuesta = await fetch(
      "/api/usuarios/restablecer-password",
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token: tokenRecuperacion,
          password
        })
      }
    );

    const datos = await leerJSON(respuesta);

    tokenRecuperacion = null;
    formNuevaPassword.reset();

    regresarAlLogin();

    mensajeLogin.textContent =
      datos.mensaje || "Contraseña actualizada correctamente.";

  } catch (error) {
    mensajeNuevaPassword.textContent = mostrarError(error);

  } finally {
    btnGuardarNuevaPassword.disabled = false;
    btnGuardarNuevaPassword.textContent = "Guardar nueva contraseña";
  }
});

// ==========================================
// CONTAR BYTES DE CONTRASEÑA EN EL NAVEGADOR
// ==========================================

function BufferByteLength(texto) {
  return new TextEncoder().encode(texto).length;
}

// ==========================================
// INICIALIZAR RECUPERACIÓN
// ==========================================

comprobarEnlaceRecuperacion();