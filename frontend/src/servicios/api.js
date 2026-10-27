import axios from 'axios';

// URL base de tu servidor Django
const API_URL = 'http://127.0.0.1:8000/api/';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de Solicitud: agrega automáticamente el token Bearer si existe
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

// Interceptor de Respuesta: renueva el token automáticamente en errores 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si el error es 401, no se ha reintentado aún y no proviene de la ruta de login
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('auth/login')
    ) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          // Solicitar un nuevo access_token usando el refresh_token
          const res = await axios.post(`${API_URL}auth/refresh/`, {
            refresh: refreshToken,
          });

          if (res.data.access) {
            localStorage.setItem('access_token', res.data.access);
            originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
            return api(originalRequest); // Reintentar la petición original con el nuevo token
          }
        } catch (refreshError) {
          // Si el refresh token también expiró o es inválido, cerrar sesión
          logout();
          window.location.reload();
          return Promise.reject(refreshError);
        }
      }
    }
    return Promise.reject(error);
  }
);

// Función para iniciar sesión
export const login = async (usuario, clave) => {
  const response = await api.post('auth/login/', { usuario, clave });
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

// --- INVENTARIO ---
export const getInventario = async () => {
  const response = await api.get('inventario/');
  return response.data;
};

export const guardarProductoAPI = async (producto) => {
  const response = await api.post('inventario/', producto);
  return response.data;
};

export const actualizarProductoAPI = async (id, producto) => {
  const response = await api.put(`inventario/${id}/`, producto);
  return response.data;
};

export const eliminarProductoAPI = async (id, rev) => {
  const response = await api.delete(`inventario/${id}/`, {
    params: { _rev: rev },
  });
  return response.data;
};

// --- HISTORIAL ---
export const getHistorialAPI = async () => {
  const response = await api.get('historial/');
  return response.data;
};

export const registrarMovimientoAPI = async (movimiento) => {
  const response = await api.post('historial/', movimiento);
  return response.data;
};

// --- DONADORES ---
export const getDonadoresAPI = async () => {
  const response = await api.get('donadores/');
  return response.data;
};

export const guardarDonadorAPI = async (donador) => {
  const response = await api.post('donadores/', donador);
  return response.data;
};

// --- USUARIOS ---
export const getUsuariosAPI = async () => {
  const response = await api.get('usuarios/');
  return response.data;
};

export const guardarUsuarioAPI = async (usuarioDoc) => {
  const response = await api.post('usuarios/', usuarioDoc);
  return response.data;
};

export const actualizarUsuarioAPI = async (id, usuarioDoc) => {
  const response = await api.put(`usuarios/${id}/`, usuarioDoc);
  return response.data;
};

export default api;