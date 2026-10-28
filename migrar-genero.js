
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const rutaBD = path.join(__dirname, "perfumeia.db");
const db = new sqlite3.Database(rutaBD);

db.all("PRAGMA table_info(perfumes)", [], (error, columnas) => {
  if (error) {
    console.error("Error al revisar la base de datos:", error.message);
    return db.close();
  }

  if (columnas.length === 0) {
    console.error("No se encontró la tabla perfumes.");
    return db.close();
  }

  const existeGenero = columnas.some(
    (columna) => columna.name === "genero"
  );

  if (existeGenero) {
    console.log("La columna genero ya existe. No se necesitan cambios.");
    return db.close();
  }

  db.run(
    "ALTER TABLE perfumes ADD COLUMN genero TEXT NOT NULL DEFAULT 'Unisex'",
    (error) => {
      if (error) {
        console.error("Error al agregar la columna:", error.message);
      } else {
        console.log("¡Columna genero agregada correctamente!");
        console.log("Los perfumes existentes se conservaron.");
      }

      db.close();
    }
  );
});
