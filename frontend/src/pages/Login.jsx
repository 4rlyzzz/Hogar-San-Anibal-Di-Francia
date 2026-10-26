import { useState } from 'react';
import logo from '../assets/logo.png';
import { IconoOjo } from '../assets/iconos.jsx';
import { largos } from '../validacion.js';
import { iniciarSesion } from '../acciones.js';
import { useFormulario, MensajeError } from '../components/Formulario.jsx';

// pantalla completa, antes de entrar a la app
export function Login() {
  const f = useFormulario();
  const [verClave, setVerClave] = useState(false);

  function entrar(e) {
    // si la clave estaba mal, queda seleccionada para escribirla de nuevo
    if (!f.enviar(e, iniciarSesion) && document.activeElement?.id === 'login-clave') document.activeElement.select();
  }

  return (
    <div className="login">
      <div className="login-marca">
        <img src={logo} alt="Logo Hogar San Aníbal di Francia" />
      </div>

      <div className="login-lado">
        <form className="login-form" id="form-login" ref={f.formulario} noValidate onSubmit={entrar}>
          <div>
            <h1>Bienvenido</h1>
            <p className="login-sub">Ingresa con tu cuenta para gestionar el inventario del hogar.</p>
          </div>

          <div className="campo">
            <label htmlFor="login-usuario">USUARIO</label>
            <input id="login-usuario" name="login-usuario" type="text" maxLength={largos.nombreUsuario} autoComplete="username" autoCapitalize="none" placeholder="Tu usuario" />
          </div>

          <div className="campo">
            <label htmlFor="login-clave">CONTRASEÑA</label>
            <div className="campo-clave">
              <input id="login-clave" name="login-clave" type={verClave ? 'text' : 'password'} maxLength={largos.clave} autoComplete="current-password" placeholder="Tu contraseña" />
              <button type="button" className={`ver-clave ${verClave ? 'activo' : ''}`} data-accion="ver-clave" aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setVerClave(!verClave)}>
                <IconoOjo />
              </button>
            </div>
          </div>

          <MensajeError texto={f.error} />

          <button type="submit" className="btn btn-verde login-entrar">Iniciar sesión</button>
        </form>
      </div>
    </div>
  );
}
