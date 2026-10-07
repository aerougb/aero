import { useState } from 'react';
import { Check, ChevronDown, Compass, ShieldCheck, Sparkles, UserRound, Zap } from 'lucide-react';

type SettingsWorkspaceProps = {
  theme: string;
  setTheme: (value: string) => void;
  accent: string;
  setAccent: (value: string) => void;
  searchEngine: string;
  setSearchEngine: (value: string) => void;
  displayName: string;
  setDisplayName: (value: string) => void;
};

type Section = 'appearance' | 'browser' | 'profile' | 'privacy';

export function SettingsWorkspace({ theme, setTheme, accent, setAccent, searchEngine, setSearchEngine, displayName, setDisplayName }: SettingsWorkspaceProps) {
  const [section, setSection] = useState<Section>('appearance');
  const sections: { id: Section; label: string; icon: typeof Sparkles }[] = [
    { id: 'appearance', label: 'Appearance', icon: Sparkles },
    { id: 'browser', label: 'Browser', icon: Compass },
    { id: 'profile', label: 'Profile & sync', icon: UserRound },
    { id: 'privacy', label: 'Privacy', icon: ShieldCheck },
  ];

  return <div className="settings-layout">
    <div className="settings-menu">
      {sections.map(({ id, label, icon: Icon }) => <button key={id} className={section === id ? 'selected' : ''} onClick={() => setSection(id)}><Icon size={16} />{label}</button>)}
    </div>
    <div className="settings-sections">
      {section === 'appearance' && <section className="surface-card setting-card"><div className="setting-title"><div><h2>Appearance</h2><p>Choose the atmosphere for your aero space.</p></div><Sparkles size={19} /></div><label className="setting-label">Theme</label><div className="choice-row">{[['midnight', 'Midnight', 'Deep and focused'], ['dawn', 'Dawn', 'Light and airy'], ['carbon', 'Carbon', 'Warm and grounded']].map(([value, label, desc]) => <button key={value} className={`theme-choice ${theme === value ? 'chosen' : ''}`} onClick={() => setTheme(value)}><span className={`theme-swatch swatch-${value}`} /><div><strong>{label}</strong><small>{desc}</small></div>{theme === value && <Check size={15} />}</button>)}</div><label className="setting-label">Accent color</label><div className="accent-row">{['cyan', 'blue', 'lime', 'coral'].map((color) => <button key={color} className={`accent-choice accent-${color} ${accent === color ? 'chosen' : ''}`} onClick={() => setAccent(color)} aria-label={color}><span /></button>)}</div></section>}
      {section === 'browser' && <section className="surface-card setting-card"><div className="setting-title"><div><h2>Browser defaults</h2><p>Set what happens when you open a new tab.</p></div><Compass size={19} /></div><label className="setting-label">Search engine</label><div className="select-wrap"><select value={searchEngine} onChange={(event) => setSearchEngine(event.target.value)}><option>Brave Search</option><option>Google</option><option>Bing</option><option>DuckDuckGo</option></select><ChevronDown size={16} /></div><div className="toggle-row"><div><strong>Open links in new tabs</strong><span>Keep your current page in place.</span></div><button className="toggle on"><span /></button></div><div className="toggle-row"><div><strong>Use compact toolbar</strong><span>More room for the page you are viewing.</span></div><button className="toggle"><span /></button></div></section>}
      {section === 'profile' && <section className="surface-card setting-card"><div className="setting-title"><div><h2>Profile & sync</h2><p>Your local profile is ready. Sign in to sync it everywhere.</p></div><UserRound size={19} /></div><label className="setting-label">Chat display name</label><input className="setting-input" value={displayName} onChange={(event) => setDisplayName(event.target.value.slice(0, 24))} /><div className="sync-callout"><Zap size={16} /><div><strong>Sync your aero space</strong><span>Bookmarks, history, preferences, and your name can follow you across devices.</span></div><button className="ghost-button">Sign in</button></div></section>}
      {section === 'privacy' && <section className="surface-card setting-card"><div className="setting-title"><div><h2>Privacy</h2><p>Keep your browsing choices under your control.</p></div><ShieldCheck size={19} /></div><div className="toggle-row"><div><strong>Save local history</strong><span>Keep recent pages available on this device.</span></div><button className="toggle on"><span /></button></div><div className="toggle-row"><div><strong>Block third-party cookies</strong><span>Reduce cross-site tracking when possible.</span></div><button className="toggle on"><span /></button></div></section>}
    </div>
  </div>;
}
