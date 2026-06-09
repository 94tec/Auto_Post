// components/ShowcaseHero.jsx
import { motion } from 'framer-motion';

import ShowcaseShareBar from './ShowcaseShareBar';

const ShowcaseHero = ({ showcase }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mb-16 overflow-hidden rounded-[3rem] border border-white/10 bg-white/[0.03] p-10"
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background: `radial-gradient(circle at top left, ${showcase.accent}50, transparent 60%)`,
        }}
      />

      <div className="relative max-w-4xl">

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />

          <span className="text-sm text-emerald-400 font-medium">
            Production Ready
          </span>
        </div>

        <h1 className="text-6xl md:text-7xl font-black text-white tracking-tight mb-5">
          {showcase.title}
        </h1>

        <p className="text-xl text-white/60 leading-relaxed max-w-3xl mb-8">
          {showcase.description}
        </p>

        <div className="flex flex-wrap gap-2 mb-10">
          {showcase.tags?.map((tag) => (
            <span
              key={tag}
              className="px-4 py-2 rounded-2xl border border-white/10 bg-white/[0.04] text-sm text-white/60"
            >
              {tag}
            </span>
          ))}
        </div>

        <ShowcaseShareBar showcase={showcase} />
      </div>
    </motion.div>
  );
};

export default ShowcaseHero;