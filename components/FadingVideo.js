const { useRef, useEffect } = React;

const FADE_MS = 500;
const FADE_OUT_LEAD = 0.55;

/**
 * Custom rAF-driven opacity crossfade loop.
 * No CSS transitions — opacity is driven purely via requestAnimationFrame.
 */
function FadingVideo({ src, className = '', style = {} }) {
  const videoRef = useRef(null);
  const rafIdRef = useRef(null);
  const fadingOutRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.style.opacity = '0';

    const cancelFade = () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };

    const fadeTo = (target, duration = FADE_MS) => {
      cancelFade();
      const startOpacity = parseFloat(video.style.opacity || '0');
      const startTime = performance.now();

      const step = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        const value = startOpacity + (target - startOpacity) * t;
        video.style.opacity = String(value);
        if (t < 1) {
          rafIdRef.current = requestAnimationFrame(step);
        } else {
          rafIdRef.current = null;
          video.style.opacity = String(target);
        }
      };

      rafIdRef.current = requestAnimationFrame(step);
    };

    const onLoadedData = () => {
      video.style.opacity = '0';
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
      fadeTo(1);
    };

    const onTimeUpdate = () => {
      if (fadingOutRef.current) return;
      const { duration, currentTime } = video;
      if (!duration || !isFinite(duration)) return;
      const remaining = duration - currentTime;
      if (remaining <= FADE_OUT_LEAD && remaining > 0) {
        fadingOutRef.current = true;
        fadeTo(0);
      }
    };

    let endTimeout = null;
    const onEnded = () => {
      video.style.opacity = '0';
      endTimeout = setTimeout(() => {
        video.currentTime = 0;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
        fadingOutRef.current = false;
        fadeTo(1);
      }, 100);
    };

    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);

    // If already loaded (cached), kick off manually
    if (video.readyState >= 2) {
      onLoadedData();
    }

    return () => {
      cancelFade();
      if (endTimeout) clearTimeout(endTimeout);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay
      muted
      playsInline
      preload="auto"
      className={className}
      style={{ ...style, opacity: 0 }}
    />
  );
}

window.FadingVideo = FadingVideo;
