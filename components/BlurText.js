const { useRef, useState, useEffect } = React;
const { motion } = window.Motion;

/**
 * Word-by-word blur-in text.
 * IntersectionObserver triggers animation when 10% visible.
 */
function BlurText({ text, className = '' }) {
  const containerRef = useRef(null);
  const [inView, setInView] = useState(false);
  const words = text.split(' ');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <p
      ref={containerRef}
      className={className}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        rowGap: '0.1em',
      }}
    >
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          initial={{ filter: 'blur(10px)', opacity: 0, y: 50 }}
          animate={
            inView
              ? {
                  filter: ['blur(10px)', 'blur(5px)', 'blur(0px)'],
                  opacity: [0, 0.5, 1],
                  y: [50, -5, 0],
                }
              : { filter: 'blur(10px)', opacity: 0, y: 50 }
          }
          transition={{
            duration: 0.7,
            times: [0, 0.5, 1],
            ease: 'easeOut',
            delay: (i * 100) / 1000,
          }}
          style={{ display: 'inline-block', marginRight: '0.28em' }}
        >
          {word}
        </motion.span>
      ))}
    </p>
  );
}

window.BlurText = BlurText;
