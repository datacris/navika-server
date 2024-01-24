const Producto = require("./models/Producto");
const Usuario = require("./models/Usuario");
const Cliente = require("./models/Cliente");
const Pedido = require("./models/Pedido");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: "variables.env" });

const crearToken = (usuario, secret, expiresIn) => {
  console.log(usuario);
  const { id, email, nombre, apellido } = usuario;
  return jwt.sign({ id, email, nombre, apellido }, secret, { expiresIn });
};

const resolvers = {
  Query: {
    // returns an array of Tracks that will be used to populate the homepage grid of our web client
    tracksForHome: (_, __, { dataSources }) => {
      return dataSources.trackAPI.getTracksForHome();
    },

    // get a single track by ID, for the track page
    track: (_, { id }, { dataSources }) => {
      return dataSources.trackAPI.getTrack(id);
    },

    // get a single module by ID, for the module detail page
    module: (_, { id }, { dataSources }) => {
      return dataSources.trackAPI.getModule(id);
    },
    obtenerUsuario: async (_, {}, ctx) => {
      // La primer version requeria enviar el token, al tenerlo dede locaStorage solo se requiere el context
      // const usuarioId = await jwt.verify(token, process.env.TOKEN_SECRET);
      // return usuarioId;
      return ctx.usuario;
    },
    obtenerProductos: async () => {
      try {
        const productos = await Producto.find({});
        return productos;
      } catch (error) {
        console.log("Error en obtenerProductos resolver ==> ", error);
        throw error;
      }
    },
    obtenerProducto: async (_, { id }) => {
      const producto = await Producto.findById(id);
      if (!producto) {
        throw new Error("Producto no encontrado");
      }
      return producto;
    },
    obtenerClientes: async () => {
      try {
        const clientes = await Cliente.find({});
        return clientes;
      } catch (error) {
        console.log("Error en obtenerClientes ==> ", error);
        throw error;
      }
    },
    obtenerClientesVendedor: async (_, {}, ctx) => {
      try {
        const clientes = await Cliente.find({
          vendedor: ctx.usuario.id.toString(),
        });
        return clientes;
      } catch (error) {
        console.log("Error en obtenerClientes ==> ", error);
        throw error;
      }
    },
    obtenerCliente: async (_, { id }, ctx) => {
      const cliente = await Cliente.findById(id);
      try {
        if (!cliente) {
          throw new Error("Cliente no encontrado");
        }
        if (cliente.vendedor.toString() !== ctx.usuario.id) {
          throw new Error("No tienes las credenciales");
        }
        return cliente;
      } catch (error) {
        console.log("Error en obtenerCliente ==> ", error);
        throw error;
      }
    },
    obtenerPedidos: async () => {
      try {
        const pedidos = await Pedido.find({});
        return pedidos;
      } catch (error) {
        console.log("Error en obtenerPedidos ==> ", error);
        throw error;
      }
    },
    obtenerPedidosVendedor: async (_, {}, ctx) => {
      try {
        const pedidos = await Pedido.find({
          vendedor: ctx.usuario.id,
        }).populate("cliente");
        return pedidos;
      } catch (error) {
        console.log("Error en obtenerPedidos ==> ", error);
        throw error;
      }
    },
    obtenerPedido: async (_, { id }, ctx) => {
      // verificar si pedido existe
      const pedido = await Pedido.findById(id);
      if (!pedido) {
        throw new Error("El pedido no existe");
      }
      // solo quien lo puede ver
      if (pedido.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }
      // retornar resultado
      return pedido;
    },
    obtenerPedidosEstado: async (_, { estado }, ctx) => {
      const pedidos = await Pedido.find({
        vendedor: ctx.usuario.id,
        estado: estado,
      });
      return pedidos;
    },
    mejoresClientes: async () => {
      const clientes = await Pedido.aggregate([
        { $match: { estado: "COMPLETADO" } },
        {
          $group: {
            _id: "$cliente",
            total: { $sum: "$total" },
          },
        },
        {
          $lookup: {
            from: "clientes",
            localField: "_id",
            foreignField: "_id",
            as: "cliente",
          },
        },
        {
          $sort: { total: -1 },
        },
      ]);
      return clientes;
    },
    mejoresVendedores: async () => {
      const vendedores = await Pedido.aggregate([
        { $match: { estado: "COMPLETADO" } },
        {
          $group: {
            _id: "$vendedor",
            total: { $sum: "$total" },
          },
        },
        {
          $lookup: {
            from: "usuarios",
            localField: "_id",
            foreignField: "_id",
            as: "vendedor",
          },
        },
        {
          $limit: 3,
        },
        {
          $sort: { total: -1 },
        },
      ]);
      return vendedores;
    },
    buscarProducto: async (_, { texto }) => {
      const productos = await Producto.find({
        $text: { $search: texto },
      }).limit(10);
      return productos;
    },
  },
  Mutation: {
    nuevoUsuario: async (_, { input }) => {
      const { email, password } = input;
      console.log(input);
      try {
        const existeUsuario = await Usuario.findOne({ email });

        // Hashing password
        const salt = await bcryptjs.genSalt(10);
        input.password = await bcryptjs.hash(password, salt);

        if (existeUsuario) {
          console.log("1 Usuario ==>");
          console.log(existeUsuario);
          console.log("2 *************************");
          throw new Error("El usuario ya existe");
        }
        const usuario = new Usuario(input);
        await usuario.save();
        return usuario;
      } catch (error) {
        console.log("Error en nuevoUsuario resolver ==> ", error);
        throw error;
      }
    },
    autenticarUsuario: async (_, { input }) => {
      const { email, password } = input;
      const existeUsuario = await Usuario.findOne({ email });

      if (!existeUsuario) {
        throw new Error("Usuario no existe");
      }
      const passwordCorrrecto = await bcryptjs.compare(
        password,
        existeUsuario.password
      );

      if (!passwordCorrrecto) {
        throw new Error("Password Incorrecto");
      }

      return {
        token: crearToken(existeUsuario, process.env.TOKEN_SECRET, "24h"),
      };
    },

    nuevoProducto: async (_, { input }) => {
      try {
        const nuevoProducto = new Producto(input);
        const resultado = await nuevoProducto.save();
        return resultado;
      } catch (error) {
        console.log("Error en nuevoProducto resolver ==> ", error);
        throw error;
      }
    },
    actualizarProducto: async (_, { id, input }) => {
      let producto = await Producto.findById(id);
      if (!producto) {
        throw new Error("Producto no encontrado");
      }
      producto = await Producto.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return producto;
    },
    eliminarProducto: async (_, { id }) => {
      const producto = await Producto.findById(id);
      if (!producto) {
        throw new Error("Producto no encontrado");
      }
      await Producto.findOneAndDelete({ _id: id });
      return "Producto eliminado";
    },
    nuevoCliente: async (_, { input }, ctx) => {
      const { email } = input;
      try {
        const cliente = await Cliente.findOne({ email });
        if (cliente) {
          throw new Error("Cliente ya registrado");
        }
        const nuevoCliente = new Cliente(input);
        nuevoCliente.vendedor = ctx.usuario.id;
        const resultado = await nuevoCliente.save();
        return resultado;
      } catch (error) {
        console.log("Error en nuevoCliente ==> ", error);
        throw error;
      }
    },
    actualizarCliente: async (_, { id, input }, ctx) => {
      // verificar si existe o no
      let cliente = await Cliente.findById(id);
      if (!cliente) {
        throw new Error("Cliente no existe");
      }
      // verificar si el vendedor es quien edita
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }
      // guardar cliente
      cliente = await Cliente.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return cliente;
    },
    eliminarCliente: async (_, { id }, ctx) => {
      // verificar si existe o no
      let cliente = await Cliente.findById(id);
      if (!cliente) {
        throw new Error("Cliente no existe");
      }
      // verificar si el vendedor es quien edita
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }
      await Cliente.findOneAndDelete({ _id: id });
      return "Cliente eliminado";
    },
    nuevoPedido: async (_, { input }, ctx) => {
      const { cliente } = input;
      // verificar si el cliente existe
      let clienteExiste = await Cliente.findById(cliente);
      if (!clienteExiste) {
        throw new Error("Cliente no existe");
      }
      // verificar si el cliente es del vendedor
      if (clienteExiste.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }
      // verificar stock dosponible
      for await (const articulo of input.pedido) {
        const { id } = articulo;
        const producto = await Producto.findById(id);
        if (articulo.cantidad > producto.existencia) {
          throw new Error(
            `La cantidad del producto ${producto.nombre} sobrepasa las existencias`
          );
        } else {
          // restar la cantidad del inventario
          producto.existencia = producto.existencia - articulo.cantidad;
          await producto.save();
        }
      }
      // crear nuevo pedido
      const nuevoPedido = new Pedido(input);
      // asignar vendedor
      nuevoPedido.vendedor = ctx.usuario.id;
      // guardar en DB
      const resultado = await nuevoPedido.save();
      return resultado;
    },
    actualizarPedido: async (_, { id, input }, ctx) => {
      const { cliente } = input;
      // pedido existe
      const existePedido = await Pedido.findById(id);
      if (!existePedido) {
        throw new Error("El pedido no existe");
      }
      // cliente existe
      const existecliente = await Cliente.findById(cliente);
      if (!existecliente) {
        throw new Error("El cliente no existe");
      }
      // cliente pertenece al vendedor
      if (existePedido.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }
      // verificar stock dosponible
      // solo lo itear cuando se van a modificar productos del pedido
      if (input.pedido) {
        for await (const articulo of input.pedido) {

          const { id } = articulo;
          const producto = await Producto.findById(id);
          console.log(producto);
          if (articulo.cantidad > producto.existencia) {
            throw new Error(
              `La cantidad del producto ${producto.nombre} sobrepasa las existencias`
            );
          } else {
            // restar la cantidad del inventario
            producto.existencia = producto.existencia - articulo.cantidad;
            await producto.save();
          }
        }
      }
      // actualiza pedido
      const resultado = await Pedido.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return resultado;
    },
    eliminarPedido: async (_, { id }, ctx) => {
      // verificar si existe el pedido
      const pedido = await Pedido.findById(id);
      if (!pedido) {
        throw new Error("El pedido no existe");
      }
      // Verificar permisos
      if (pedido.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tiene las credenciales");
      }
      await Pedido.findOneAndDelete({ _id: id });
      return "Pedido Eliminado";
    },
    // increments a track's numberOfViews property
    incrementTrackViews: async (_, { id }, { dataSources }) => {
      try {
        const track = await dataSources.trackAPI.incrementTrackViews(id);
        return {
          code: 200,
          success: true,
          message: `Successfully incremented number of views for track ${id}`,
          track,
        };
      } catch (err) {
        return {
          code: err.extensions.response.status,
          success: false,
          message: err.extensions.response.body,
          track: null,
        };
      }
    },
  },
  Track: {
    author: ({ authorId }, _, { dataSources }) => {
      return dataSources.trackAPI.getAuthor(authorId);
    },

    modules: ({ id }, _, { dataSources }) => {
      return dataSources.trackAPI.getTrackModules(id);
    },
  },
};

module.exports = resolvers;
