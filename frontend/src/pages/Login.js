import logo from '../assets/logo.png';
import { iconoOjo } from '../assets/icons.js';

// pantalla completa, antes de entrar a la app
// desktop: logo a la izquierda y formulario a la derecha; celular: uno debajo del otro
export function paginaLogin() {
  return `
    <div class="login">
      <div class="login-marca">
        <img src="${logo}" alt="Logo Hogar San Aníbal di Francia">
      </div>

      <div class="login-lado">
        <form class="login-form" id="form-login" novalidate>
          <div>
            <h1>Bienvenido</h1>
            <p class="login-sub">Ingresa con tu cuenta para gestionar el inventario del hogar.</p>
          </div>

          <div class="campo">
            <label for="login-usuario">USUARIO</label>
            <input id="login-usuario" type="text" autocomplete="username" autocapitalize="none" placeholder="Tu usuario">
          </div>

          <div class="campo">
            <label for="login-clave">CONTRASEÑA</label>
            <div class="campo-clave">
              <input id="login-clave" type="password" autocomplete="current-password" placeholder="Tu contraseña">
              <button type="button" class="ver-clave" data-accion="ver-clave" aria-label="Mostrar contraseña">${iconoOjo}</button>
            </div>
          </div>

          <p class="error" id="error"></p>

          <button type="submit" class="btn btn-verde login-entrar">Iniciar sesión</button>
        </form>
      </div>
    </div>
  `;
}
