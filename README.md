# PerfumeIA
### Asistente inteligente para recomendación y gestión de perfumes

**Universidad:** Universidad Mariano Gálvez de Guatemala
**Facultad:** Ingeniería en Sistemas de Información y Ciencias de la Computación
**Curso:** Análisis de Sistemas II
**Estudiante:** Anthony Jacob Barrios Pérez
**Docente:** Ing. Edgar Raúl Molina Rey

---

## 1. Descripción del proyecto

PerfumeIA es una aplicación web desarrollada para facilitar la elección de perfumes mediante inteligencia artificial.

El sistema permite que los usuarios ingresen sus gustos y preferencias, como el tipo de aroma, la ocasión de uso o las características que buscan en una fragancia. Esta información se procesa mediante la API de Groq para generar recomendaciones personalizadas.

Además, PerfumeIA incorpora un catálogo de perfumes, registro de usuarios, autenticación, historial de conversaciones y funciones administrativas.

El proyecto fue desarrollado como parte del curso Análisis de Sistemas II, aplicando conocimientos de desarrollo web, bases de datos, integración de servicios externos y ciberseguridad.

## 2. Objetivo general

Desarrollar una aplicación web que utilice inteligencia artificial para recomendar perfumes de acuerdo con las preferencias de los usuarios, facilitando la búsqueda de fragancias y permitiendo administrar la información mediante una plataforma interactiva.

## 3. Funcionalidades principales

- Registro e inicio de sesión de usuarios.
- Recuperación de contraseña mediante correo electrónico.
- Consulta y edición de información del perfil.
- Recomendaciones personalizadas mediante inteligencia artificial.
- Integración con la API de Groq.
- Catálogo de perfumes con búsqueda y filtros.
- Consulta de presentaciones de perfumes.
- Historial privado de conversaciones.
- Consulta de recomendaciones anteriores.
- Panel de administración.
- Almacenamiento de información mediante SQLite.
- Validaciones de entradas y manejo de errores.

## 4. Tecnologías utilizadas

**Frontend**
- HTML5.
- CSS3.
- JavaScript.

**Backend**
- Node.js.
- Express.js.

**Base de datos**
- SQLite3.

**Inteligencia artificial**
- API de Groq.
- Biblioteca `groq-sdk`.

**Seguridad y autenticación**
- `bcryptjs`.
- `express-session`.
- `express-rate-limit`.
- `dotenv`.

**Correo electrónico**
- Nodemailer.

**Control de versiones**
- Git.
- GitHub.

## 5. Requisitos para ejecutar el proyecto

Antes de iniciar, se necesita:

- Node.js y npm instalados.
- Conexión a Internet para utilizar la API de Groq.
- Una clave válida de Groq.
- Una cuenta de correo configurada para las funciones de recuperación de contraseña.
- Un editor de código, como Visual Studio Code.

## 6. Instalación

**Paso 1. Clonar el repositorio**

```bash
git clone https://github.com/abarriosp6-crypto/PerfumeIA.git
```

**Paso 2. Ingresar a la carpeta**

```bash
cd PerfumeIA
```

**Paso 3. Instalar las dependencias**

```bash
npm install
```

**Paso 4. Configurar las variables de entorno**

Crear un archivo llamado `.env` en la raíz del proyecto y configurar las siguientes variables:

```dotenv
GROQ_API_KEY=
ADMIN_PASSWORD_HASH=
SESSION_SECRET=
EMAIL_USER=
EMAIL_APP_PASSWORD=
```

Descripción de las variables:

- `GROQ_API_KEY`: clave de acceso al servicio de inteligencia artificial de Groq.
- `ADMIN_PASSWORD_HASH`: hash de la contraseña administrativa.
- `SESSION_SECRET`: clave secreta utilizada para proteger las sesiones; debe tener al menos 32 caracteres.
- `EMAIL_USER`: dirección de correo utilizada por el sistema.
- `EMAIL_APP_PASSWORD`: contraseña de aplicación para el servicio de correo.

**Por seguridad, nunca deben publicarse las credenciales reales ni el archivo `.env` en GitHub.**

## 7. Ejecución

Para iniciar el servidor, ejecutar:

```bash
npm start
```

También se encuentra disponible:

```bash
npm run dev
```

Una vez iniciado, abrir en el navegador:

```text
http://localhost:3000
```

El servidor verifica la configuración de seguridad e inicializa los componentes necesarios para ejecutar la aplicación.

## 8. Funcionamiento de la inteligencia artificial

El proceso de recomendación sigue este flujo:

1. El usuario ingresa sus preferencias.
2. La aplicación recibe y valida la consulta.
3. El backend envía la solicitud a la API de Groq.
4. El modelo de inteligencia artificial procesa la información.
5. PerfumeIA presenta las recomendaciones generadas.
6. La conversación puede almacenarse en SQLite para su posterior consulta.

Este funcionamiento permite ofrecer recomendaciones según los gustos y necesidades de cada usuario.

## 9. Base de datos

PerfumeIA utiliza SQLite para almacenar información de la aplicación.

Entre los datos administrados se encuentran:

- Usuarios registrados.
- Información de perfumes.
- Conversaciones.
- Mensajes asociados a las conversaciones.
- Historial de consultas y recomendaciones.

El sistema permite consultar conversaciones anteriores y mantener el historial asociado al usuario correspondiente.

## 10. Ciberseguridad

El proyecto incorpora medidas para proteger la información y reducir riesgos de seguridad:

- Almacenamiento de credenciales mediante variables de entorno.
- Validación de variables obligatorias al iniciar el servidor.
- Uso de hashes para contraseñas.
- Manejo de sesiones de usuario.
- Cookies con las opciones `httpOnly` y `sameSite: strict`.
- Configuración de cookies seguras para entornos de producción con HTTPS.
- Limitación de solicitudes mediante `express-rate-limit`.
- Validación de entradas antes de procesar consultas.
- Restricción del tamaño de solicitudes JSON.
- Protección del historial según la sesión del usuario.
- Manejo de errores en las operaciones del sistema.

## 11. Manejo de errores

PerfumeIA contempla situaciones que pueden afectar el funcionamiento de la aplicación, como:

- Consultas vacías o inválidas.
- Errores de autenticación.
- Fallos de conexión con servicios externos.
- Problemas al procesar solicitudes.
- Errores relacionados con el acceso a información.

Estas situaciones deben manejarse mediante validaciones y mensajes que permitan informar al usuario sin exponer información sensible.

## 12. Estructura general del proyecto

```text
PerfumeIA/
├── public/
│   ├── css/
│   ├── js/
│   ├── index.html
│   ├── script.js
│   └── style.css
├── app.js
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

Adicionalmente, el proyecto utiliza archivos locales de configuración y base de datos que requieren un tratamiento adecuado para proteger la información.

## 13. Ejecución y demostración

Para demostrar el funcionamiento del sistema se recomienda realizar las siguientes pruebas:

1. Iniciar sesión con una cuenta válida.
2. Consultar el catálogo de perfumes.
3. Ingresar una preferencia y solicitar recomendaciones.
4. Verificar que la inteligencia artificial genere una respuesta.
5. Consultar el historial de conversaciones.
6. Probar una entrada inválida y verificar el mensaje correspondiente.
7. Comprobar el funcionamiento de las opciones administrativas.

## 14. Mejoras futuras

Entre las posibles mejoras del proyecto se encuentran:

- Publicar la aplicación en un servicio de alojamiento web.
- Integrar PerfumeIA con una tienda de perfumes.
- Consultar inventario y disponibilidad en tiempo real.
- Mejorar continuamente la precisión de las recomendaciones.
- Optimizar la organización interna del código.

## 15. Conclusión

El desarrollo de PerfumeIA me permitió aplicar los conocimientos adquiridos durante el curso de Análisis de Sistemas II mediante la creación de una aplicación web que integra inteligencia artificial, base de datos y mecanismos de seguridad.

Durante el proyecto trabajé en el diseño de la interfaz, la integración con Groq, el almacenamiento de información y la implementación de funcionalidades para usuarios y administradores.

Como resultado, desarrollé una herramienta que facilita la recomendación de perfumes y que puede continuar mejorándose para utilizarse en un entorno comercial.