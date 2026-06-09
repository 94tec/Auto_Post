// showcase/components/ShowcaseSidebar.jsx
import XShareButtons from './XShareButtons';

const ShowcaseSidebar = ({ showcase }) => {
  return (
    <div className="space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-sm text-emerald-400 font-medium">Production Ready</span>
        </div>

        <h1 className="text-5xl font-black leading-none text-white mb-4">
          {showcase.title}
        </h1>

        <p className="text-lg text-white/70 leading-relaxed">
          {showcase.description}
        </p>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {showcase.tags?.map((tag, i) => (
          <span
            key={i}
            className="px-4 py-1.5 text-xs rounded-2xl bg-white/5 border border-white/10 text-white/70"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Share Buttons */}
      <div className="pt-6">
        <XShareButtons showcase={showcase} />
      </div>
    </div>
  );
};

export default ShowcaseSidebar;