const Hero = window.Hero;
const Capabilities = window.Capabilities;

function App() {
  return (
    <main className="bg-black text-white min-h-screen">
      <Hero />
      <Capabilities />
    </main>
  );
}

window.App = App;

// Mount after all component scripts have evaluated (App is last in the load order)
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
