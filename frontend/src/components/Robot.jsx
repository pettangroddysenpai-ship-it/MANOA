import { motion } from 'framer-motion';

export const robotStyle = {
  mouthTopPercent: 76,
  mouthWidthPercent: 22,
  blinkEveryMs: 4200,
};

export default function Robot({ talking = false, size = 220, speaking = false, message = null }) {
  const mouthTop = (size * robotStyle.mouthTopPercent) / 100;
  const mouthWidth = (size * robotStyle.mouthWidthPercent) / 100;

  return (
    <div className="relative flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            boxShadow: speaking
              ? ['0 0 30px 6px rgba(96,165,250,.75)', '0 0 60px 18px rgba(96,165,250,.95)', '0 0 30px 6px rgba(96,165,250,.75)']
              : '0 0 24px 4px rgba(96,165,250,.35)',
            transition: { duration: speaking ? 0.9 : 0.5 },
          }}
        />
        <motion.div
          className="absolute inset-0"
          animate={{ y: [0, -9, 0], transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }}
        >
          <motion.div
            className="h-full w-full"
            animate={
              speaking
                ? { scaleY: [1, 1.02, 0.96, 1.02, 1], rotate: [-1.5, 1.5, -1.5], transition: { duration: 0.45, repeat: Infinity } }
                : { scaleY: [1, 1, 0.1, 1, 1], transition: { duration: robotStyle.blinkEveryMs / 1000, times: [0, 0.88, 0.92, 0.96, 1], repeat: Infinity } }
            }
          >
            <img
              src="/manoa.jpg"
              alt="MANOA le robot"
              draggable={false}
              className="h-full w-full rounded-full object-cover select-none"
            />
            {speaking && (
              <motion.div
                className="absolute rounded-full"
                style={{
                  top: mouthTop,
                  left: '50%',
                  width: mouthWidth,
                  height: 6,
                  transform: 'translateX(-50%)',
                  background: 'rgba(10,15,30,0.9)',
                  border: '2px solid rgba(96,165,250,0.9)',
                }}
                animate={{ height: [6, 14, 7, 13, 6], transition: { duration: 0.3, repeat: Infinity } }}
              />
            )}
          </motion.div>
        </motion.div>
        {speaking && (
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0.15, 0.35], transition: { duration: 0.8, repeat: Infinity } }}
            style={{ border: '2px solid rgba(96,165,250,0.8)' }}
          />
        )}
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass relative mt-4 max-w-full rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-slate-100"
        >
          {message}
          <span className="absolute -top-1.5 left-4 h-3 w-3 rotate-45 border-l border-t border-[rgba(96,165,250,.18)] bg-[#0f1e37]" />
        </motion.div>
      )}
    </div>
  );
}
