import { Component } from 'react';
import { useEstado } from './estado.js';
import { usuario } from './data/datos.js';
import { Layout } from './components/Layout.jsx';
import { Login } from './pages/Login.jsx';

// si algo falla al dibujar, muestra un aviso en vez de dejar la pantalla en blanco
class AtraparErrores extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="vacio">
        Ocurrió un error inesperado. <button className="link" onClick={() => location.reload()}>Volver a cargar</button>
      </div>
    );
  }
}

export function App() {
  useEstado();
  return <AtraparErrores>{usuario.id ? <Layout /> : <Login />}</AtraparErrores>;
}
