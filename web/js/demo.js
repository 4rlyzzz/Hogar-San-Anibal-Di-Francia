const db = new PouchDB("casa_hogar");

// No se olviden colocar la contraseña :P
const remoteDB = new PouchDB(
    "http://casa_app:<CONTRASEÑA>@127.0.0.1:5984/casa_hogar"
);

const estado = document.getElementById("estado");
const productosLocales = document.getElementById("productosLocales");
const pendientes = document.getElementById("pendientes");


async function actualizarEstado() {
    const resultado = await db.allDocs();
    const total = resultado.rows.length;

    productosLocales.textContent = total;

    console.log("Documentos locales:", total);
}


const sync = db.sync(remoteDB, {
    live: true,
    retry: true
});

sync.on("active", function () {
    console.log("Sincronización activa");
});

sync.on("change", async function (info) {
    console.log("Sincronización realizada:", info);
    await actualizarEstado();
});

sync.on("paused", async function () {
    console.log("Sincronización pausada");
    await actualizarEstado();
});

sync.on("error", function (error) {
    console.error("Error de sincronización:", error);
});


// COMPROBAR SI COUCHDB ESTÁ DISPONIBLE

async function comprobarConexion() {
    try {
        const respuesta = await fetch(
            "http://127.0.0.1:5984/",
            {
                method: "HEAD"
            }
        );

        if (respuesta.ok) {
            estado.textContent = "CouchDB conectado!!";
        } else {
            estado.textContent = "CouchDB sin conexión :(";
        }

    } catch (error) {
        estado.textContent = "CouchDB sin conexión :(";
    }
}


setInterval(comprobarConexion, 3000);
comprobarConexion();

document.getElementById("btnAgregar").addEventListener("click", async function () {

    const nombre = document.getElementById("nombre").value;
    const categoria = document.getElementById("categoria").value;
    const almacen = document.getElementById("almacen").value;
    const cantidad = Number(document.getElementById("cantidad").value);
    const unidad = document.getElementById("unidad").value;


    if (!nombre || !cantidad || !unidad) {
        alert("Completa los campos obligatorios");
        return;
    }


    const producto = {
        tipo: "producto",
        nombre: nombre,
        categoria: categoria,
        almacen: almacen,
        cantidad: cantidad,
        unidad: unidad
    };


    try {

        const resultado = await db.post(producto);

        console.log("Producto guardado localmente:", resultado);

        alert("Producto guardado en PouchDB");

        await actualizarEstado();


        document.getElementById("nombre").value = "";
        document.getElementById("categoria").value = "";
        document.getElementById("almacen").value = "";
        document.getElementById("cantidad").value = "";
        document.getElementById("unidad").value = "";

    } catch (error) {

        console.error("Error al guardar:", error);

        alert("No se pudo guardar el producto");
    }
});


document.getElementById("btnMostrar").addEventListener("click", async function () {

    const resultado = await db.allDocs({
        include_docs: true
    });


    const lista = document.getElementById("listaProductos");
    lista.innerHTML = "";

    resultado.rows.forEach(function (row) {

        const producto = row.doc;


        if (producto.tipo === "producto") {

            const elemento = document.createElement("li");

            elemento.textContent =
                producto.nombre +
                " - " +
                producto.cantidad +
                " " +
                producto.unidad +
                " - " + producto.almacen;

            lista.appendChild(elemento);
        }

    });

});


actualizarEstado();