const ArrowUpRight = window.ArrowUpRight;

const NAV_LINKS = ['Home', 'Voyages', 'Worlds', 'Innovation', 'Plan Launch'];

function Navbar() {
  return (
    <nav className="fixed top-4 left-0 right-0 z-50 px-8 lg:px-16 flex items-center justify-between">
      {/* Logo */}
      <a
        href="#"
        className="liquid-glass flex items-center justify-center w-12 h-12 rounded-full shrink-0"
        aria-label="Home"
      >
        <span className="font-heading italic text-white text-2xl leading-none select-none">
          a
        </span>
      </a>

      {/* Center nav — desktop only */}
      <div className="hidden md:flex items-center liquid-glass rounded-full px-1.5 py-1.5">
        {NAV_LINKS.map((label) => (
          <a
            key={label}
            href={`#${label.toLowerCase().replace(/\s+/g, '-')}`}
            className="px-3 py-2 text-sm font-medium text-white/90 font-body"
          >
            {label}
          </a>
        ))}
        <a
          href="#claim"
          className="ml-1 inline-flex items-center gap-1.5 bg-white text-black rounded-full px-4 py-2 text-sm font-medium font-body whitespace-nowrap"
        >
          Claim a Spot
          <ArrowUpRight className="h-4 w-4" size={16} />
        </a>
      </div>

      {/* Right spacer balances logo */}
      <div className="w-12 h-12 shrink-0" aria-hidden="true" />
    </nav>
  );
}

window.Navbar = Navbar;
