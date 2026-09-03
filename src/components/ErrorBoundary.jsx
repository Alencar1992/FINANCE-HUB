import React from "react";

// Protege o aplicativo contra tela branca e oferece recuperação segura ao usuário.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, details) {
    console.error("Erro não tratado na interface", error, details);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main role="alert" className="fatal-error">
        <h1>Não foi possível abrir esta tela</h1>
        <p>Seus dados continuam seguros. Atualize o aplicativo para tentar novamente.</p>
        <button type="button" onClick={() => window.location.reload()}>Atualizar aplicativo</button>
      </main>
    );
  }
}
