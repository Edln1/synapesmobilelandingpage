const { motion } = window.Motion;
const FadingVideo = window.FadingVideo;
const BlurText = window.BlurText;
const Navbar = window.Navbar;
const ArrowUpRight = window.ArrowUpRight;
const Play = window.Play;
const ClockIcon = window.ClockIcon;
const GlobeIcon = window.GlobeIcon;

const HERO_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4';

const PARTNERS = ['Aeon', 'Vela', 'Apex', 'Orbit', 'Zeno'];

const fadeUp = {
  initial: { filter: 'blur(10px)', opacity: 0, y: 20 },
  animate: { filter: 'blur(0px)', opacity: 1, y: 0 },
};

function Hero() {
  return (
    <section className="relative min-h-screen w-full bg-black overflow-hidden flex flex-col">
      {/* Background video — 120% scale, top-aligned focal point */}
      <FadingVideo
        src={HERO_VIDEO}
        className="absolute left-1/2 top-0 -translate-x-1/2 object-cover object-top z-0"
        style={{ width: '120%', height: '120%' }}
      />

      {/* Content layer */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        {/* Hero content — centered */}
        <div className="flex-1 flex flex-col items-center justify-center pt-24 px-4 text-center">
          {/* Badge */}
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.4 }}
            className="liquid-glass rounded-full inline-flex items-center gap-2 mb-6"
          >
            <span className="bg-white text-black px-3 py-1 text-xs font-semibold rounded-full font-body">
              New
            </span>
            <span className="text-sm text-white/90 pr-3 font-body">
              Maiden Crewed Voyage to Mars Arrives 2026
            </span>
          </motion.div>

          {/* Headline — word-by-word BlurText */}
          <BlurText
            text="Venture Past Our Sky Across the Universe"
            className="text-6xl md:text-7xl lg:text-[5.5rem] font-heading italic text-white leading-[0.8] max-w-2xl justify-center tracking-[-4px]"
          />

          {/* Subheading */}
          <motion.p
            {...fadeUp}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.8 }}
            className="mt-4 text-sm md:text-base text-white max-w-2xl font-body font-light leading-tight"
          >
            Discover the universe in ways once unimaginable. Our pioneering vessels
            and breakthrough engineering bring deep-space exploration within
            reach—secure and extraordinary.
          </motion.p>

          {/* CTAs */}
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 1.1 }}
            className="flex items-center gap-6 mt-6"
          >
            <a
              href="#start"
              className="liquid-glass-strong rounded-full px-5 py-2.5 text-sm font-medium text-white font-body inline-flex items-center gap-2"
            >
              Start Your Voyage
              <ArrowUpRight className="h-5 w-5" size={20} />
            </a>
            <a
              href="#liftoff"
              className="inline-flex items-center gap-2 text-sm font-medium text-white font-body"
            >
              View Liftoff
              <Play className="h-4 w-4" size={16} />
            </a>
          </motion.div>

          {/* Stats */}
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 1.3 }}
            className="flex items-stretch gap-4 mt-8"
          >
            <div className="liquid-glass p-5 w-[220px] rounded-[1.25rem] flex flex-col items-start text-left">
              <ClockIcon className="text-white h-7 w-7" size={28} />
              <div className="mt-auto pt-6">
                <p className="font-heading italic text-white text-4xl tracking-[-1px] leading-none">
                  34.5 Min
                </p>
                <p className="text-xs text-white font-body font-light mt-2">
                  Average Videos Watch Time
                </p>
              </div>
            </div>
            <div className="liquid-glass p-5 w-[220px] rounded-[1.25rem] flex flex-col items-start text-left">
              <GlobeIcon className="text-white h-7 w-7" size={28} />
              <div className="mt-auto pt-6">
                <p className="font-heading italic text-white text-4xl tracking-[-1px] leading-none">
                  2.8B+
                </p>
                <p className="text-xs text-white font-body font-light mt-2">
                  Users Across the Globe
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Partners */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 1.4 }}
          className="flex flex-col items-center gap-4 pb-8"
        >
          <span className="liquid-glass rounded-full px-3.5 py-1 text-xs font-medium text-white font-body">
            Collaborating with top aerospace pioneers globally
          </span>
          <div className="flex items-center gap-12 md:gap-16 flex-wrap justify-center">
            {PARTNERS.map((name) => (
              <span
                key={name}
                className="font-heading italic text-white text-2xl md:text-3xl tracking-tight"
              >
                {name}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

window.Hero = Hero;
