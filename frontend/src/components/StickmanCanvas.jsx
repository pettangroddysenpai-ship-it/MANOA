import { motion } from 'framer-motion';

const INK = '#cbd5e1';
const ACCENT = '#4ade80';
const GREEN = '#34d399';
const AMBER = '#fbbf24';

function Stickman({ x, y, s = 1, pose = 'stand', color = INK, arm = null }) {
  const armRight = arm === 'point' ? 'M0 -14 L26 -26' : 'M0 -14 L20 -4';
  const legSwing =
    pose === 'sit'
      ? null
      : [
          { from: 'M0 4 L-8 26', to: 'M0 4 L-11 26', dur: '1s', begin: '0s' },
          { from: 'M0 4 L8 26', to: 'M0 4 L11 26', dur: '1s', begin: '0s' },
        ];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke={color} strokeWidth="3.5" fill="none" strokeLinecap="round">
      <circle cx="0" cy="-34" r="9" fill={color} stroke="none" />
      {pose === 'sit' ? (
        <>
          <path d="M0 -25 L0 0 L26 10 L34 30" />
          <path d="M0 -25 L-22 -2 L-26 18" />
        </>
      ) : (
        <>
          <path d="M0 -25 L0 6" />
          <path d="M0 -14 L-18 -2" />
          <path d={armRight} />
          {legSwing.map((l, i) => (
            <g key={i}>
              <path d={l.from}>
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="0 0 6; 18 0 6; 0 0 6; -18 0 6; 0 0 6"
                  dur={l.dur}
                  begin={l.begin}
                  repeatCount="indefinite"
                  additive="sum"
                />
              </path>
            </g>
          ))}
        </>
      )}
    </g>
  );
}

function Packet({ path, dur, color, begin = '0s' }) {
  return (
    <circle r="4.5" fill={color}>
      <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={path} />
    </circle>
  );
}

function PopEdgeScene() {
  const foPath = 'M135 115 L285 115';
  const fhPath = 'M135 185 L285 185';
  return (
    <g>
      <rect x="25" y="60" width="105" height="150" rx="8" fill="#1e3a5f" stroke="#60a5fa" strokeWidth="2" />
      <text x="77" y="140" textAnchor="middle" fontSize="15" fontWeight="bold" fill={ACCENT}>POP</text>
      <rect x="30" y="70" width="95" height="18" rx="3" fill="#0b1626" />
      <text x="77" y="84" textAnchor="middle" fontSize="10" fill={INK}>Point de Presence</text>

      <rect x="290" y="60" width="105" height="150" rx="8" fill="#3b2f1e" stroke="#fbbf24" strokeWidth="2" />
      <text x="342" y="140" textAnchor="middle" fontSize="15" fontWeight="bold" fill={AMBER}>Provider</text>
      <text x="342" y="156" textAnchor="middle" fontSize="15" fontWeight="bold" fill={AMBER}>Edge</text>
      <rect x="295" y="70" width="95" height="18" rx="3" fill="#0b1626" />
      <text x="342" y="84" textAnchor="middle" fontSize="10" fill={INK}>Cote transport</text>

      <line x1="130" y1="115" x2="290" y2="115" stroke="#34d399" strokeWidth="3" />
      <text x="210" y="100" textAnchor="middle" fontSize="11" fill={GREEN}>FO - Fibre Optique</text>
      <line x1="130" y1="185" x2="290" y2="185" stroke="#cbd5e1" strokeWidth="3" strokeDasharray="8 6" />
      <text x="210" y="205" textAnchor="middle" fontSize="11" fill={INK}>FH - Faisceau Hertzien</text>

      <Packet path={foPath} dur="2.5s" color={GREEN} />
      <Packet path={foPath} dur="2.5s" color={GREEN} begin="1.25s" />
      <Packet path={fhPath} dur="3.5s" color={ACCENT} begin="0.8s" />
      <Packet path={fhPath} dur="3.5s" color={ACCENT} begin="2.5s" />

      <Stickman x={120} y={235} pose="stand" arm="point" />
      <text x="120" y="268" textAnchor="middle" fontSize="10" fill={INK}>Ingenieur Matrix</text>
      <Stickman x={305} y={235} s={0.9} color="#94a3b8" />
      <text x="305" y="265" textAnchor="middle" fontSize="10" fill="#94a3b8">NOC transport</text>

      <path d="M210 40 m-20 0 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0" fill="none" stroke="#60a5fa" strokeWidth="1.5" opacity="0.5">
        <animate attributeName="opacity" values="0.2;0.8;0.2" dur="2s" repeatCount="indefinite" />
      </path>
    </g>
  );
}

function ConfigureDeviceScene({ app }) {
  return (
    <g>
      <rect x="0" y="240" width="420" height="60" fill="#1e293b" />
      <rect x="0" y="240" width="420" height="5" fill="#334155" />

      <rect x="200" y="205" width="120" height="35" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="2" />
      <text x="260" y="228" textAnchor="middle" fontSize="12" fontFamily="monospace" fill={GREEN}>
        config t
        <animate attributeName="fill" values="#34d399;#34d399;#0f172a" dur="1.2s" repeatCount="indefinite" />
      </text>

      <rect x="60" y="215" width="90" height="10" rx="2" fill="#334155" />
      <rect x="70" y="225" width="70" height="15" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
      <text x="105" y="236" textAnchor="middle" fontSize="9" fill={INK}>{app || 'Terminal'}</text>

      <rect x="290" y="195" width="55" height="45" rx="4" fill="#3b2f1e" stroke={AMBER} strokeWidth="2" />
      <rect x="306" y="170" width="23" height="28" rx="3" fill="#3b2f1e" stroke={AMBER} strokeWidth="2" />
      <line x1="290" y1="210" x2="240" y2="210" stroke={ACCENT} strokeWidth="3" />
      <circle cx="297" cy="172" r="5" fill={AMBER}>
        <animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite" />
      </circle>
      <text x="317" y="185" textAnchor="middle" fontSize="8" fill={AMBER}>Router</text>

      <rect x="350" y="215" width="45" height="25" rx="3" fill="#1e3a5f" stroke={ACCENT} strokeWidth="2" />
      <text x="372" y="232" textAnchor="middle" fontSize="8" fill={ACCENT}>Switch</text>

      <path d="M240 240 L250 205" stroke="#475569" strokeWidth="2" fill="none" />
      <path d="M240 240 L300 212" stroke="#475569" strokeWidth="2" fill="none" />
      <path d="M240 240 L360 228" stroke="#475569" strokeWidth="2" fill="none" />

      <Stickman x={145} y={215} s={0.95} pose="sit" />
      <path d="M120 195 A8 8 0 0 1 134 195" stroke={INK} strokeWidth="2" fill="none">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="0.8s" repeatCount="indefinite" />
      </path>
      <text x="128" y="205" textAnchor="middle" fontSize="10" fill={INK}>{app || 'Configurer'}</text>
      <text x="210" y="55" textAnchor="middle" fontSize="13" fontWeight="bold" fill={ACCENT}>Configuration de l'equipement</text>
    </g>
  );
}

function PingTestScene() {
  const out = 'M150 150 L330 150';
  const back = 'M330 170 L150 170';
  return (
    <g>
      <rect x="30" y="60" width="110" height="150" rx="8" fill="#0f172a" stroke={GREEN} strokeWidth="2" />
      <text x="85" y="120" textAnchor="middle" fontSize="12" fill={INK}>PC</text>
      <text x="85" y="140" textAnchor="middle" fontSize="10" fill="#94a3b8">ping</text>

      <rect x="320" y="70" width="85" height="130" rx="8" fill="#1e3a5f" stroke={ACCENT} strokeWidth="2" />
      <text x="362" y="115" textAnchor="middle" fontSize="10" fill={INK}>Serveur /</text>
      <text x="362" y="128" textAnchor="middle" fontSize="10" fill={INK}>Passerelle</text>
      <line x1="362" y1="70" x2="362" y2="50" stroke={ACCENT} strokeWidth="3" />
      <circle cx="362" cy="42" r="7" fill="none" stroke={ACCENT} strokeWidth="2" />
      <circle cx="362" cy="42" r="2" fill={ACCENT} />

      <line x1="140" y1="150" x2="320" y2="150" stroke={GREEN} strokeWidth="2" strokeDasharray="6 5" />
      <line x1="320" y1="170" x2="140" y2="170" stroke={ACCENT} strokeWidth="2" strokeDasharray="6 5" />
      <text x="230" y="140" textAnchor="middle" fontSize="9" fill={GREEN}>requetes (64 octets)</text>
      <text x="230" y="188" textAnchor="middle" fontSize="9" fill={ACCENT}>reponses (echo)</text>
      <Packet path={out} dur="1.6s" color={GREEN} />
      <Packet path={out} dur="1.6s" color={GREEN} begin="0.8s" />
      <Packet path={back} dur="1.6s" color={ACCENT} begin="0.4s" />
      <Packet path={back} dur="1.6s" color={ACCENT} begin="1.2s" />

      <Stickman x={85} y={235} pose="stand" />
      <text x="85" y="266" textAnchor="middle" fontSize="10" fill={INK}>Technicien</text>

      <g>
        <text x="230" y="230" textAnchor="middle" fontSize="13" fontWeight="bold" fill={GREEN}>
          PING 8.8.8.8
          <animate attributeName="opacity" values="1;0.5;1" dur="1.6s" repeatCount="indefinite" />
        </text>
        <text x="230" y="248" textAnchor="middle" fontSize="10" fill="#94a3b8">
          temps=8 ms
          <animate attributeName="opacity" values="0.4;1;0.4" dur="1.6s" repeatCount="indefinite" />
        </text>
        <text x="230" y="266" textAnchor="middle" fontSize="11" fill={GREEN}>✓ 4 reponses recues</text>
      </g>
    </g>
  );
}

function AppWalkthroughScene({ app }) {
  return (
    <g>
      <rect x="25" y="40" width="230" height="210" rx="10" fill="#0f172a" stroke={ACCENT} strokeWidth="2.5" />
      <rect x="25" y="40" width="230" height="28" rx="10" fill="#1e3a5f" />
      <rect x="25" y="58" width="230" height="10" fill="#1e3a5f" />
      <circle cx="45" cy="54" r="4" fill="#f87171" />
      <circle cx="60" cy="54" r="4" fill="#fbbf24" />
      <circle cx="75" cy="54" r="4" fill="#34d399" />
      <text x="170" y="59" textAnchor="middle" fontSize="13" fontWeight="bold" fill={INK}>{app || 'Application'}</text>

      <rect x="40" y="82" width="200" height="16" rx="4" fill="#334155" />
      <rect x="40" y="106" width="150" height="12" rx="3" fill="#1e293b" stroke="#475569" />
      <rect x="40" y="124" width="90" height="12" rx="3" fill="#1e293b" stroke="#475569" />
      <rect x="40" y="142" width="200" height="50" rx="4" fill="#1e293b" stroke="#475569" />
      <line x1="55" y1="158" x2="225" y2="158" stroke="#475569" strokeWidth="2" />
      <line x1="55" y1="172" x2="200" y2="172" stroke="#475569" strokeWidth="2" />
      <rect x="40" y="200" width="90" height="18" rx="4" fill={ACCENT}>
        <animate attributeName="opacity" values="1;0.6;1" dur="1s" repeatCount="indefinite" />
      </rect>
      <text x="85" y="214" textAnchor="middle" fontSize="9" fill="#0b1626">Connecter</text>

      <g>
        <text x="120" y="20" textAnchor="middle" fontSize="11" fill="#94a3b8">Etape 1: Ouvrir</text>
        <text x="120" y="34" textAnchor="middle" fontSize="11" fill="#94a3b8">Etape 2: IP / port / login</text>
      </g>

      <path d="M285 60 C 315 55 320 100 305 120" stroke={ACCENT} strokeWidth="2" strokeDasharray="5 4" fill="none">
        <animate attributeName="strokeDashoffset" values="0;-18" dur="1s" repeatCount="indefinite" />
      </path>

      <g>
        <path d="M340 175 l0 28" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <path d="M325 175 a15 15 0 0 1 30 0 z" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" values="-8 340 160;8 340 160;-8 340 160" dur="1.2s" repeatCount="indefinite" />
        </path>
      </g>

      <Stickman x={305} y={185} s={0.95} pose="sit" />
      <text x="305" y="225" textAnchor="middle" fontSize="10" fill={INK}>J'apprends {app || 'le logiciel'}</text>
      <text x="210" y="280" textAnchor="middle" fontSize="12" fontWeight="bold" fill={ACCENT}>{`Utilisation de ${app || "l'application"}`}</text>
    </g>
  );
}

function InspectionScene({ title }) {
  return (
    <g>
      <rect x="120" y="120" width="80" height="60" rx="6" fill="#0f172a" stroke="#475569" strokeWidth="2" />
      <circle cx="140" cy="140" r="4" fill="#f87171">
        <animate attributeName="opacity" values="1;0.2;1" dur="0.8s" repeatCount="indefinite" />
      </circle>
      <circle cx="156" cy="140" r="4" fill="#fbbf24">
        <animate attributeName="opacity" values="0.2;1;0.2" dur="0.8s" repeatCount="indefinite" begin="0.3s" />
      </circle>
      <circle cx="172" cy="140" r="4" fill="#34d399">
        <animate attributeName="opacity" values="0.2;1;0.2" dur="0.8s" repeatCount="indefinite" begin="0.6s" />
      </circle>
      <line x1="180" y1="120" x2="180" y2="100" stroke="#475569" strokeWidth="3" />
      <path d="M120 120 a25 25 0 0 1 25 -25" fill="none" stroke="#60a5fa" strokeWidth="2" opacity="0.6">
        <animate attributeName="opacity" values="0.2;0.9;0.2" dur="1.4s" repeatCount="indefinite" />
      </path>
      <text x="160" y="100" textAnchor="middle" fontSize="10" fill="#60a5fa">signal?</text>

      <g>
        <circle cx="205" cy="100" r="17" fill="none" stroke={ACCENT} strokeWidth="4">
          <animateTransform attributeName="transform" type="rotate" values="-12 205 100;12 205 100;-12 205 100" dur="2s" repeatCount="indefinite" />
        </circle>
        <line x1="216" y1="112" x2="236" y2="132" stroke={ACCENT} strokeWidth="4" strokeLinecap="round" />
      </g>

      <Stickman x={200} y={170} s={0.95} pose="stand" arm="point" color={INK} />
      <text x="200" y="212" textAnchor="middle" fontSize="10" fill={INK}>Inspection de l'equipement</text>
      <text x="210" y="280" textAnchor="middle" fontSize="12" fontWeight="bold" fill={ACCENT}>{title || 'Verification'}</text>
    </g>
  );
}

function Grid() {
  return (
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M24 0 L0 0 0 24" fill="none" stroke="#ffffff" strokeOpacity="0.05" />
    </pattern>
  );
}

const SCENES = {
  'pop-edge': PopEdgeScene,
  'configure-device': ConfigureDeviceScene,
  'ping-test': PingTestScene,
  'app-walkthrough': AppWalkthroughScene,
  inspection: InspectionScene,
};

export default function StickmanCanvas({ scene = 'inspection', app = '', title = '' }) {
  const Scene = SCENES[scene] || InspectionScene;
  return (
    <motion.div
      key={scene}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="simulation-container"
    >
      <div className="simulation-box">
        <span />
        <span />
        <span />
        <span />
        <div className="simulation-content">
          <svg viewBox="-38 0 496 300" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              <Grid />
            </defs>
            <rect x="-38" y="38" width="496" height="262" fill="url(#grid)" />
            <Scene app={app} title={title} />
          </svg>
          <div className="simulation-label">Simulation - {scene.replace(/-/g, ' ')}</div>
        </div>
      </div>
    </motion.div>
  );
}
