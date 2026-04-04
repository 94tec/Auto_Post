// components/EditProfileModal.jsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX, FiUser, FiMail, FiPhone, FiFileText,
  FiGlobe, FiBell, FiImage, FiAlertCircle,
  FiCheckCircle, FiCamera, FiShield,
} from 'react-icons/fi';
import { userApi, authApi } from '../utils/api';
import toast from 'react-hot-toast';

/* ── design tokens ───────────────────────────────────────────── */
const C = {
  navy:    '#0A0E1A',
  slate:   '#141924',
  mid:     '#0D1220',
  card:    '#1A2235',
  border:  'rgba(255,255,255,0.07)',
  amber:   '#F59E0B',
  orange:  '#F97316',
  indigo:  '#818CF8',
  muted:   'rgba(255,255,255,0.38)',
  dim:     'rgba(255,255,255,0.18)',
};

/* ── timezones ───────────────────────────────────────────────── */
const TIMEZONES = [
  'Africa/Nairobi', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Cairo',
  'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris',
  'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
];

/* ── nav sections ────────────────────────────────────────────── */
const SECTIONS = [
  { id: 'identity', label: 'Identity',      icon: FiUser    },
  { id: 'contact',  label: 'Contact',       icon: FiPhone   },
  { id: 'image',    label: 'Avatar',        icon: FiCamera  },
  { id: 'prefs',    label: 'Preferences',   icon: FiBell    },
];

/* ── tiny helpers ────────────────────────────────────────────── */
const Label = ({ children }) => (
  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>
    {children}
  </p>
);

const Field = ({ label, error, children }) => (
  <div style={{ marginBottom: 16 }}>
    <Label>{label}</Label>
    {children}
    {error && (
      <p style={{ display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, color: '#f87171', marginTop: 5 }}>
        <FiAlertCircle size={11} />{error}
      </p>
    )}
  </div>
);

const inputStyle = (focused, error) => ({
  width: '100%',
  padding: '10px 12px',
  background: C.mid,
  border: `1px solid ${error ? '#f87171' : focused ? C.amber : C.border}`,
  borderRadius: 10,
  color: '#fff',
  fontSize: 13,
  outline: 'none',
  transition: 'border-color 0.15s',
  boxSizing: 'border-box',
});

const Input = ({ label, error, type = 'text', icon: Icon, ...props }) => {
  const [focused, setFocused] = useState(false);
  return (
    <Field label={label} error={error}>
      <div style={{ position: 'relative' }}>
        {Icon && (
          <Icon size={14} style={{
            position: 'absolute', left: 11, top: '50%',
            transform: 'translateY(-50%)', color: C.muted, pointerEvents: 'none',
          }} />
        )}
        <input
          type={type}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ ...inputStyle(focused, error), paddingLeft: Icon ? 32 : 12 }}
          {...props}
        />
      </div>
    </Field>
  );
};

const Textarea = ({ label, ...props }) => {
  const [focused, setFocused] = useState(false);
  return (
    <Field label={label}>
      <textarea
        rows={4}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...inputStyle(focused, false),
          resize: 'none',
          lineHeight: 1.6,
          fontFamily: 'inherit',
        }}
        {...props}
      />
    </Field>
  );
};

const Toggle = ({ checked, onChange, label, sub }) => (
  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12,
                  cursor: 'pointer', marginBottom: 14 }}>
    <div
      onClick={onChange}
      style={{
        flexShrink: 0, marginTop: 2,
        width: 36, height: 20, borderRadius: 999,
        background: checked
          ? `linear-gradient(to right, ${C.amber}, ${C.orange})`
          : C.border,
        border: `1px solid ${checked ? 'transparent' : C.dim}`,
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s',
      }}
    >
      <motion.div
        animate={{ x: checked ? 17 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          position: 'absolute', top: 2,
          width: 14, height: 14, borderRadius: '50%', background: '#fff',
        }}
      />
    </div>
    <div>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 1 }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: C.muted }}>{sub}</p>}
    </div>
  </label>
);

/* ── section panels ──────────────────────────────────────────── */
const IdentityPanel = ({ data, errors, onChange }) => (
  <div>
    <Input
      label="Display Name"
      name="displayName"
      value={data.displayName}
      onChange={onChange}
      error={errors.displayName}
      icon={FiUser}
      placeholder="Your full name"
    />
    <Input
      label="Email Address"
      name="email"
      type="email"
      value={data.email}
      onChange={onChange}
      error={errors.email}
      icon={FiMail}
      placeholder="you@example.com"
    />
    <Field label="Bio">
      <Textarea
        label=""
        name="bio"
        value={data.bio}
        onChange={onChange}
        placeholder="A short sentence about yourself…"
      />
    </Field>
  </div>
);

const ContactPanel = ({ data, errors, onChange }) => (
  <div>
    <Input
      label="Phone Number"
      name="phone"
      value={data.phone}
      onChange={onChange}
      error={errors.phone}
      icon={FiPhone}
      placeholder="+254 712 345 678"
    />
    <Field label="Timezone">
      <div style={{ position: 'relative' }}>
        <select
          name="timezone"
          value={data.timezone}
          onChange={onChange}
          style={{
            ...inputStyle(false, false),
            paddingLeft: 32,
            appearance: 'none',
            cursor: 'pointer',
          }}
        >
          {TIMEZONES.map(tz => (
            <option key={tz} value={tz} style={{ background: C.slate }}>{tz}</option>
          ))}
        </select>
        <FiGlobe size={14} style={{
          position: 'absolute', left: 11, top: '50%',
          transform: 'translateY(-50%)', color: C.muted, pointerEvents: 'none',
        }} />
      </div>
    </Field>
  </div>
);

const AvatarPanel = ({ data, errors, onChange }) => (
  <div>
    {/* live preview */}
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
      <div style={{
        width: 96, height: 96, borderRadius: '50%', overflow: 'hidden',
        background: `linear-gradient(135deg, ${C.amber}30, ${C.orange}20)`,
        border: `2px solid ${C.amber}60`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {data.profileImage ? (
          <img src={data.profileImage} alt="Preview"
               style={{ width: '100%', height: '100%', objectFit: 'cover' }}
               onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <span style={{ fontSize: 36, fontWeight: 900, color: C.amber }}>
            {(data.displayName || '?').charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    </div>
    <Input
      label="Image URL"
      name="profileImage"
      value={data.profileImage}
      onChange={onChange}
      error={errors.profileImage}
      icon={FiImage}
      placeholder="https://example.com/avatar.jpg"
    />
    <p style={{ fontSize: 11, color: C.muted, marginTop: -8 }}>
      Paste any publicly accessible image URL. The preview updates live.
    </p>
  </div>
);

const PrefsPanel = ({ data, onChange }) => {
  const toggle = (key) => onChange({
    target: { type: 'checkbox', name: `preferences.${key}`, checked: !data.preferences[key] },
  });
  return (
    <div>
      <Label>Notifications</Label>
      <div style={{
        background: C.mid, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: '16px 18px', marginBottom: 16,
      }}>
        <Toggle
          checked={data.preferences.emailNotifications}
          onChange={() => toggle('emailNotifications')}
          label="Email notifications"
          sub="Order updates, account alerts"
        />
        <Toggle
          checked={data.preferences.smsNotifications}
          onChange={() => toggle('smsNotifications')}
          label="SMS notifications"
          sub="Text alerts for important events"
        />
        <Toggle
          checked={data.preferences.marketingEmails}
          onChange={() => toggle('marketingEmails')}
          label="Marketing emails"
          sub="Newsletters and promotions"
        />
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   MAIN MODAL
══════════════════════════════════════════════════════════════ */
export default function EditProfileModal({ isOpen, onClose, currentUser, profile, onUpdate }) {
  const [active,   setActive]   = useState('identity');
  const [loading,  setLoading]  = useState(false);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [errors,   setErrors]   = useState({});

  const [data, setData] = useState({
    displayName:  '',
    email:        '',
    phone:        '',
    bio:          '',
    profileImage: '',
    timezone:     'Africa/Nairobi',
    preferences: {
      emailNotifications: true,
      smsNotifications:   false,
      marketingEmails:    false,
    },
  });

  /* reset on open */
  useEffect(() => {
    if (!isOpen) return;
    setData({
      displayName:  currentUser?.displayName || '',
      email:        currentUser?.email        || '',
      phone:        profile?.phone            || '',
      bio:          profile?.bio              || '',
      profileImage: profile?.profileImage     || '',
      timezone:     profile?.timezone         || 'Africa/Nairobi',
      preferences: {
        emailNotifications: profile?.preferences?.emailNotifications ?? true,
        smsNotifications:   profile?.preferences?.smsNotifications   ?? false,
        marketingEmails:    profile?.preferences?.marketingEmails    ?? false,
      },
    });
    setActive('identity');
    setErrors({});
    setEmailVerificationSent(false);
  }, [isOpen, currentUser, profile]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox' && name.startsWith('preferences.')) {
      const key = name.split('.')[1];
      setData(p => ({ ...p, preferences: { ...p.preferences, [key]: checked } }));
    } else {
      setData(p => ({ ...p, [name]: value }));
    }
    if (errors[name]) setErrors(p => ({ ...p, [name]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!data.displayName.trim())               e.displayName   = 'Required';
    if (!data.email.trim())                     e.email         = 'Required';
    else if (!/\S+@\S+\.\S+/.test(data.email)) e.email         = 'Invalid email';
    if (data.phone && !/^\+?[\d\s\-()]{8,20}$/.test(data.phone))
                                                e.phone         = 'Invalid number';
    if (data.profileImage && !/^https?:\/\/\S+\.\S+/.test(data.profileImage))
                                                e.profileImage  = 'Must be a valid URL';
    setErrors(e);
    // navigate to first section that has an error
    if (e.displayName || e.email)               setActive('identity');
    else if (e.phone)                           setActive('contact');
    else if (e.profileImage)                    setActive('image');
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const emailChanged = data.email.trim() !== currentUser?.email;

      if (emailChanged) {
        await userApi.updateProfileAdvanced({
          displayName: data.displayName.trim(),
          email:       data.email.trim(),
        });
        setEmailVerificationSent(true);
        toast.success('Verification sent to your new email address.');
        setLoading(false);
        return;
      }

      await userApi.updateProfile({ displayName: data.displayName.trim() });
      toast.success('Profile updated');
      onUpdate?.(
        { ...currentUser, displayName: data.displayName },
        { ...profile, phone: data.phone, bio: data.bio,
          profileImage: data.profileImage, timezone: data.timezone,
          preferences: data.preferences },
      );
      onClose();
    } catch (err) {
      toast.error(err.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const PANELS = {
    identity: <IdentityPanel data={data} errors={errors} onChange={handleChange} />,
    contact:  <ContactPanel  data={data} errors={errors} onChange={handleChange} />,
    image:    <AvatarPanel   data={data} errors={errors} onChange={handleChange} />,
    prefs:    <PrefsPanel    data={data}                 onChange={handleChange} />,
  };

  const errorCount = Object.keys(errors).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(6px)',
            padding: '16px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{    opacity: 0, scale: 0.97, y: 16  }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            style={{
              background: C.slate,
              border: `1px solid ${C.border}`,
              borderRadius: 20,
              boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
              width: '100%',
              maxWidth: 720,
              // Fixed height — fills viewport on small screens, capped on large
              height: 'min(88vh, 560px)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* ── header ─────────────────────────────────────── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 24px',
              borderBottom: `1px solid ${C.border}`,
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* avatar mini */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                  background: `linear-gradient(135deg, ${C.amber}30, ${C.orange}20)`,
                  border: `1.5px solid ${C.amber}50`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {data.profileImage
                    ? <img src={data.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontWeight: 900, color: C.amber, fontSize: 16 }}>
                        {(data.displayName || currentUser?.displayName || '?').charAt(0).toUpperCase()}
                      </span>
                  }
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>
                    Edit Profile
                  </h2>
                  <p style={{ margin: 0, fontSize: 11, color: C.muted }}>
                    {currentUser?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 6, borderRadius: 8,
                  color: C.muted, display: 'flex',
                  transition: 'color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.border; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none';   e.currentTarget.style.color = C.muted; }}
              >
                <FiX size={18} />
              </button>
            </div>

            {/* ── body (sidebar + panel) ──────────────────────── */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

              {/* sidebar nav */}
              <nav style={{
                width: 148, flexShrink: 0,
                borderRight: `1px solid ${C.border}`,
                padding: '12px 8px',
                display: 'flex', flexDirection: 'column', gap: 2,
                background: C.navy,
              }}>
                {SECTIONS.map(({ id, label, icon: Icon }) => {
                  const isActive = active === id;
                  const hasError = (id === 'identity' && (errors.displayName || errors.email))
                                || (id === 'contact'  && errors.phone)
                                || (id === 'image'    && errors.profileImage);
                  return (
                    <button
                      key={id}
                      onClick={() => setActive(id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9,
                        padding: '9px 10px',
                        borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: isActive
                          ? `linear-gradient(135deg, ${C.amber}18, ${C.orange}0A)`
                          : 'none',
                        borderLeft: isActive ? `2px solid ${C.amber}` : '2px solid transparent',
                        color: isActive ? C.amber : C.muted,
                        fontSize: 12, fontWeight: isActive ? 600 : 400,
                        transition: 'all 0.15s',
                        textAlign: 'left', width: '100%',
                        position: 'relative',
                      }}
                      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = C.border; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}}
                      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'none';   e.currentTarget.style.color = C.muted; }}}
                    >
                      <Icon size={14} />
                      {label}
                      {hasError && (
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: '#f87171', marginLeft: 'auto',
                        }} />
                      )}
                    </button>
                  );
                })}

                {/* spacer + email status */}
                <div style={{ flex: 1 }} />
                {!currentUser?.emailVerified && (
                  <div style={{
                    padding: '8px 10px', borderRadius: 8,
                    background: `${C.amber}12`, border: `1px solid ${C.amber}22`,
                    display: 'flex', alignItems: 'flex-start', gap: 6,
                  }}>
                    <FiAlertCircle size={11} style={{ color: C.amber, marginTop: 1, flexShrink: 0 }} />
                    <p style={{ fontSize: 10, color: C.amber, margin: 0, lineHeight: 1.4 }}>
                      Email unverified
                    </p>
                  </div>
                )}
                {emailVerificationSent && (
                  <div style={{
                    padding: '8px 10px', borderRadius: 8,
                    background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)',
                    display: 'flex', alignItems: 'flex-start', gap: 6,
                  }}>
                    <FiCheckCircle size={11} style={{ color: '#34D399', marginTop: 1, flexShrink: 0 }} />
                    <p style={{ fontSize: 10, color: '#34D399', margin: 0, lineHeight: 1.4 }}>
                      Verification sent
                    </p>
                  </div>
                )}
              </nav>

              {/* panel content */}
              <div style={{
                flex: 1, overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
              }}>
                {/* scrollable field area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={active}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.14 }}
                    >
                      {PANELS[active]}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* ── footer actions ────────────────────────────── */}
                <div style={{
                  flexShrink: 0,
                  padding: '14px 24px',
                  borderTop: `1px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: C.navy,
                }}>
                  {errorCount > 0 && (
                    <p style={{
                      fontSize: 11, color: '#f87171',
                      display: 'flex', alignItems: 'center', gap: 5,
                      flex: 1,
                    }}>
                      <FiAlertCircle size={11} />
                      {errorCount} field{errorCount > 1 ? 's' : ''} need attention
                    </p>
                  )}
                  <div style={{ flex: 1 }} />
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      padding: '9px 18px', borderRadius: 10, border: `1px solid ${C.border}`,
                      background: 'none', color: C.muted, fontSize: 13, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.border; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none';   e.currentTarget.style.color = C.muted; }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{
                      padding: '9px 24px', borderRadius: 10, border: 'none',
                      background: loading ? C.border : `linear-gradient(135deg, ${C.amber}, ${C.orange})`,
                      color: loading ? C.muted : C.navy,
                      fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'opacity 0.15s',
                      opacity: loading ? 0.6 : 1,
                    }}
                    onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.88'; }}
                    onMouseLeave={e => { if (!loading) e.currentTarget.style.opacity = '1'; }}
                  >
                    {loading ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}