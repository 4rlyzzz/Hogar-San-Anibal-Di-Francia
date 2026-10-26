import axios from 'axios';

// URL base de tu servidor Django
const API_URL = 'http://127.0.0.1:8000/api/';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: agrega automáticamente el token Bearer si existe en localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Función para iniciar sesión
export const login = async (username, password) => {
  const response = await api.post('auth/login/', { username, password });
  if (response.data.access) {
    localStorage.setItem('access_token', response.data.access);
    localStorage.setItem('refresh_token', response.data.refresh);
  }
  return response.data;
};

// Función para cerrar sesión
export const logout = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
};

// Función para obtener el inventario desde Django
export const getInventario = async () => {
  const response = await api.get('inventario/');
  return response.data;
};

export default api;

// Crear o guardar un producto nuevo
export const guardarProductoAPI = async (producto) => {
  const response = await api.post('inventario/', producto);
  return response.data;
};

// Actualizar stock o datos de un producto existente
export const actualizarProductoAPI = async (id, producto) => {
  const response = await api.put(`inventario/${id}/`, producto);
  return response.data;
};

// Obtener el historial completo
export const getHistorialAPI = async () => {
  const response = await api.get('historial/');
  return response.data;
};

// Registrar un movimiento (ingreso, salida, ajuste)
export const registrarMovimientoAPI = async (movimiento) => {
  const response = await api.post('historial/', movimiento);
  return response.data;
};

// Obtener lista de donadores
export const getDonadoresAPI = async () => {
  const response = await api.get('donadores/');
  return response.data;
};

// Crear un nuevo donador
export const guardarDonadorAPI = async (donador) => {
  const response = await api.post('donadores/', donador);
  return response.data;
};

// Obtener lista de usuarios
export const getUsuariosAPI = async () => {
  const response = await api.get('usuarios/');
  return response.data;
};

// Crear usuario
export const guardarUsuarioAPI = async (usuarioDoc) => {
  const response = await api.post('usuarios/', usuarioDoc);
  return response.data;
};

// Actualizar usuario (Rol / Activo)
export const actualizarUsuarioAPI = async (id, usuarioDoc) => {
  const response = await api.put(`usuarios/${id}/`, usuarioDoc);
  return response.data;
};