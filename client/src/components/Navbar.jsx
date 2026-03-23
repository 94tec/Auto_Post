// Navbar.jsx — active section tracking, smooth scroll, role-aware, contact trigger
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth }  from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import useRole      from '../hooks/useRole';
import {
  FiSun, FiMoon, FiLogIn, FiLogOut, FiMenu, FiX,
  FiHome, FiGrid, FiBookOpen, FiZap, FiMail,
  FiShield, FiActivity, FiBarChart2,
} from 'react-icons/fi';

const ACCENT  = '#F59E0B';
const ACCENT2 = '#F97316';
const SLATE   = '#141924';

const SECTION_LINKS = [
  { id:'hero',     label:'Home',     icon:FiHome      },
  { id:'features', label:'Features', icon:FiZap       },
  { id:'how',      label:'How',      icon:FiActivity  },
  { id:'stats',    label:'Stats',    icon:FiBarChart2 },
  { id:'contact',  label:'Contact',  icon:FiMail      },
];

const PAGE_LINKS = [
  { to:'/',          label:'Home',      icon:FiHome     },
  { to:'/dashboard', label:'Dashboard', icon:FiGrid     },
  { to:'/quotes',    label:'Quotes',    icon:FiBookOpen },
  { to:'/docs',      label:'Docs',      icon:FiBookOpen },
];

const ActivePip = ({ color = ACCENT }) => (
  <motion.span layoutId="pip"
    className="absolute -bottom-[3px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
    style={{ background: color }}
    transition={{ type:'spring', stiffness:500, damping:30 }} />
);

const Navbar = ({ activeSection='hero', onSectionClick, onContactOpen }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout }       = useAuth();
  const { isAdmin }            = useRole();
  const navigate               = useNavigate();
  const location               = useLocation();
  const isLanding              = location.pathname === '/';

  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', fn, { passive:true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const handleSection = (e, id) => {
    e.preventDefault();
    if (id === 'contact') { onContactOpen?.(); }
    else if (isLanding && onSectionClick) { onSectionClick(id); }
    else { navigate('/', { state:{ scrollTo:id } }); }
    setMenuOpen(false);
  };

  return (
    <motion.nav
      initial={{ y:-72, opacity:0 }} animate={{ y:0, opacity:1 }}
      transition={{ duration:0.5, ease:[0.25,0.46,0.45,0.94] }}
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={scrolled
        ? { background:`${SLATE}F2`, backdropFilter:'blur(24px)', borderBottom:'1px solid rgba(255,255,255,0.06)', boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }
        : { background:'transparent' }
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 shrink-0">
          <motion.div whileHover={{ rotate:6, scale:1.06 }} transition={{ duration:0.2 }}
            className="w-8 h-8 rounded-[10px] flex items-center justify-center text-gray-950 font-black text-sm shadow-lg"
            style={{ background:`linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>D</motion.div>
          <span className="font-extrabold text-[17px] tracking-tight text-white">
            Damu<span style={{ color:ACCENT }}>chi</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-0.5">
          {(isLanding ? SECTION_LINKS : PAGE_LINKS).map((item) => {
            const isSection = 'id' in item;
            const active    = isSection ? activeSection === item.id : location.pathname === item.to;
            const Icon      = item.icon;
            const key       = isSection ? item.id : item.to;
            return (
              <a key={key}
                href={isSection ? `#${item.id}` : item.to}
                onClick={isSection ? (e) => handleSection(e, item.id) : (e) => { e.preventDefault(); navigate(item.to); }}
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-all hover:bg-white/8"
                style={active ? { color:ACCENT, background:`${ACCENT}12` } : { color:'rgba(255,255,255,0.45)' }}>
                <Icon size={12} />{item.label}
                {active && <ActivePip />}
              </a>
            );
          })}

          {isAdmin && (
            <Link to="/admin"
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-all hover:bg-white/8"
              style={location.pathname==='/admin' ? {color:'#818CF8',background:'rgba(129,140,248,0.12)'} : {color:'rgba(255,255,255,0.45)'}}>
              <FiShield size={12}/>Admin
              {location.pathname==='/admin' && <ActivePip color="#818CF8"/>}
            </Link>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <motion.button whileHover={{ scale:1.08, rotate:15 }} whileTap={{ scale:0.92 }}
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/8 hover:bg-white/15 transition-colors"
            style={{ color:ACCENT }}>
            {theme === 'dark' ? <FiSun size={15}/> : <FiMoon size={15}/>}
          </motion.button>

          {user ? (
            <div className="flex items-center gap-2">
              <motion.button whileHover={{ scale:1.02 }} onClick={() => navigate('/dashboard')}
                className="hidden sm:flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-xl text-[13px] font-medium bg-white/8 hover:bg-white/15 text-white border border-white/10 transition-all">
                <div className="relative w-6 h-6 rounded-lg flex items-center justify-center text-gray-950 text-[11px] font-black"
                     style={{ background:`linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>
                  {(user.displayName?.[0] || user.email?.[0] || '?').toUpperCase()}
                  {isAdmin && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center"
                          style={{ background:'#818CF8' }}>
                      <FiShield size={6} className="text-white"/>
                    </span>
                  )}
                </div>
                <span className="max-w-[100px] truncate">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
              </motion.button>

              <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }}
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-semibold text-red-400 border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 transition-all">
                <FiLogOut size={13}/><span className="hidden sm:inline">Sign out</span>
              </motion.button>
            </div>
          ) : (
            <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }}
              onClick={() => navigate('/auth/login')}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[13px] font-semibold text-gray-950 shadow-md"
              style={{ background:`linear-gradient(to right,${ACCENT},${ACCENT2})` }}>
              <FiLogIn size={13}/>Sign in
            </motion.button>
          )}

          <motion.button whileTap={{ scale:0.9 }}
            onClick={() => setMenuOpen(o => !o)}
            className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-white hover:bg-white/10 transition-colors">
            <AnimatePresence mode="wait">
              {menuOpen
                ? <motion.span key="x"    initial={{rotate:-90,opacity:0}} animate={{rotate:0,opacity:1}} exit={{rotate:90,opacity:0}}  transition={{duration:0.14}}><FiX    size={17}/></motion.span>
                : <motion.span key="menu" initial={{rotate:90,opacity:0}}  animate={{rotate:0,opacity:1}} exit={{rotate:-90,opacity:0}} transition={{duration:0.14}}><FiMenu size={17}/></motion.span>
              }
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }}
            exit={{ height:0, opacity:0 }} transition={{ duration:0.22, ease:[0.22,1,0.36,1] }}
            className="md:hidden overflow-hidden border-t border-white/8"
            style={{ background:`${SLATE}F8`, backdropFilter:'blur(24px)' }}>
            <div className="px-4 py-3 space-y-0.5">
              {(isLanding ? SECTION_LINKS : PAGE_LINKS).map((item) => {
                const isSection = 'id' in item;
                const active    = isSection ? activeSection === item.id : location.pathname === item.to;
                const Icon      = item.icon;
                return (
                  <a key={isSection ? item.id : item.to}
                    href={isSection ? `#${item.id}` : item.to}
                    onClick={isSection
                      ? (e) => handleSection(e, item.id)
                      : (e) => { e.preventDefault(); navigate(item.to); setMenuOpen(false); }
                    }
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors"
                    style={active ? {color:ACCENT,background:`${ACCENT}12`} : {color:'rgba(255,255,255,0.60)'}}>
                    <Icon size={13}/>{item.label}
                    {active && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{background:ACCENT}}/>}
                  </a>
                );
              })}

              {isAdmin && (
                <Link to="/admin" onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors"
                  style={location.pathname==='/admin' ? {color:'#818CF8',background:'rgba(129,140,248,0.1)'} : {color:'rgba(255,255,255,0.60)'}}>
                  <FiShield size={13}/>Admin Panel
                </Link>
              )}

              <div className="pt-2 mt-2 border-t border-white/8">
                {user ? (
                  <button onClick={() => { logout(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium text-red-400 hover:bg-red-500/12 transition-colors">
                    <FiLogOut size={13}/>Sign out · {user.displayName || user.email?.split('@')[0]}
                  </button>
                ) : (
                  <button onClick={() => { navigate('/auth/login'); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold hover:bg-amber-500/10 transition-colors"
                    style={{ color:ACCENT }}>
                    <FiLogIn size={13}/>Sign in
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;