// FeaturesGrid.jsx — standalone external component used on Landing
import { motion } from 'framer-motion';
import { FiZap, FiBookOpen, FiBriefcase, FiStar } from 'react-icons/fi';

const SLATE = '#141924';

const FEATURES = [
  {
    icon: FiZap,
    title: 'Instant Inspiration',
    desc:  'Fresh quotes every 10s or on demand from a curated Firebase collection.',
    color: '#F59E0B',
  },
  {
    icon: FiBookOpen,
    title: 'Curated Wisdom',
    desc:  'Hand-picked quotes by category — mindset, discipline, growth and more.',
    color: '#818CF8',
  },
  {
    icon: FiBriefcase,
    title: 'Full Dashboard',
    desc:  'Add, edit, delete and search your own quotes with category filtering.',
    color: '#A78BFA',
  },
  {
    icon: FiStar,
    title: 'Save Favourites',
    desc:  'Bookmark quotes that move you and return to them whenever you need a lift.',
    color: '#34D399',
  },
];

const FeaturesGrid = () => (
  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
    {FEATURES.map(({ icon: Icon, title, desc, color }, i) => (
      <motion.div
        key={title}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: i * 0.08 }}
        whileHover={{ y: -4 }}
        className="p-5 rounded-2xl border border-white/8 hover:border-white/15 transition-all cursor-default"
        style={{ background: SLATE }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
          style={{ background: `${color}18` }}
        >
          <Icon size={16} style={{ color }} />
        </div>
        <h3 className="text-[14px] font-bold mb-1.5 text-white">{title}</h3>
        <p className="text-[12px] leading-relaxed text-white/40">{desc}</p>
      </motion.div>
    ))}
  </div>
);

export default FeaturesGrid;