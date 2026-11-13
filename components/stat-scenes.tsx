/**
 * Small animated scenes for the Created / Closed / Open cards on Positions.
 * Pure SVG + CSS (see the "Stat card scenes" block in globals.css), blue and white only.
 */

const BLUE = "#1e50cc";
const BLUE_LIGHT = "#5b8def";
const NAVY = "#0e1b3d";
const PALE = "#dbe8fb";
const SKIN = "#eef4fd";

function Scene({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg
      viewBox="0 0 240 90"
      className="block h-[88px] w-full"
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMax meet"
    >
      <ellipse cx="120" cy="85" rx="100" ry="3.5" fill={PALE} />
      {children}
    </svg>
  );
}

type Facing = "front" | "left" | "right";

/**
 * A person standing with their feet at y = 83 (about 70 tall). `x` is the centre.
 * Arms are drawn by each scene so they can move; shoulders sit at (x ± 10, 38).
 */
function Person({
  x,
  shirt = BLUE,
  hair = "short",
  facing = "front",
  badge = false,
}: {
  x: number;
  shirt?: string;
  hair?: "short" | "long";
  facing?: Facing;
  badge?: boolean;
}) {
  const look = facing === "left" ? -2 : facing === "right" ? 2 : 0;
  return (
    <g>
      {hair === "long" && <path d={`M${x - 9.5} 22 q-1 12 1 15 h17 q2-3 1-15z`} fill={NAVY} />}
      {/* legs and shoes */}
      <rect x={x - 9} y={55} width={8} height={25} rx={2.5} fill={NAVY} />
      <rect x={x + 1} y={55} width={8} height={25} rx={2.5} fill={NAVY} />
      <rect x={x - 10.5 + look * 0.6} y={79} width={10.5} height={4.5} rx={2.2} fill={BLUE} />
      <rect x={x + 0.5 + look * 0.6} y={79} width={10.5} height={4.5} rx={2.2} fill={BLUE} />
      {/* neck, torso */}
      <rect x={x - 3} y={29} width={6} height={6} fill={SKIN} />
      <path d={`M${x - 11} 40 q0-8 7-8 h8 q7 0 7 8 v18 h-22z`} fill={shirt} />
      <path d={`M${x - 3.5} 32 l3.5 5 3.5-5z`} fill="#fff" opacity={0.9} />
      {badge && (
        <>
          <rect x={x + 2} y={41} width={6} height={8} rx={1.2} fill="#fff" />
          <rect x={x + 3.2} y={42.5} width={3.6} height={1.6} rx={0.6} fill={BLUE} />
        </>
      )}
      {/* head and hair */}
      <circle cx={x} cy={22} r={8.5} fill={SKIN} />
      <path
        d={
          hair === "long"
            ? `M${x - 9} 22 a9 9 0 0 1 18 0 q-5-5.5-9-5.5 q-4 0-9 5.5z`
            : `M${x - 8.8} 21 a8.8 8.8 0 0 1 17.6 0 q-3-3.5-8.8-3.5 q-5.8 0-8.8 3.5z`
        }
        fill={NAVY}
      />
      <circle cx={x - 3 + look} cy={23} r={1.15} fill={NAVY} />
      <circle cx={x + 3 + look} cy={23} r={1.15} fill={NAVY} />
      <path d={`M${x - 2.5 + look} 27.2q2.5 2.2 5 0`} stroke={NAVY} strokeWidth={1.1} fill="none" strokeLinecap="round" />
    </g>
  );
}

function Arm({ d, color = BLUE, hand }: { d: string; color?: string; hand: [number, number] }) {
  return (
    <>
      <path d={d} stroke={color} strokeWidth={5.5} strokeLinecap="round" fill="none" />
      <circle cx={hand[0]} cy={hand[1]} r={3.4} fill={SKIN} stroke={color} strokeWidth={0.8} />
    </>
  );
}

/** Created: a person holding up a "We're hiring" board and waving. */
export function CreatedScene() {
  return (
    <Scene label="A person waving and holding a hiring board">
      <g className="scene-board">
        <rect x={125} y={44} width={3.5} height={39} rx={1.7} fill={BLUE} />
        <rect x={100} y={8} width={64} height={38} rx={6} fill="#fff" stroke={BLUE} strokeWidth={2.5} />
        <text x={132} y={25} textAnchor="middle" fontSize={9} fontWeight={800} fill={BLUE}>
          WE&apos;RE
        </text>
        <text x={132} y={38} textAnchor="middle" fontSize={11.5} fontWeight={800} fill={BLUE}>
          HIRING
        </text>
      </g>
      <Person x={80} facing="right" />
      {/* arm holding the board post */}
      <Arm d="M90 40 Q104 58 125 58" hand={[126, 58]} />
      {/* waving arm */}
      <g transform="translate(70 39)">
        <g className="scene-wave">
          <path d="M0 0 L-9 -17" stroke={BLUE} strokeWidth={5.5} strokeLinecap="round" />
          <circle cx={-10} cy={-19.5} r={3.6} fill={SKIN} stroke={BLUE} strokeWidth={0.8} />
        </g>
      </g>
    </Scene>
  );
}

/** Closed: two people shaking hands to welcome the new joiner. */
export function ClosedScene() {
  return (
    <Scene label="Two people shaking hands to welcome a new employee">
      <Person x={88} facing="right" />
      <Person x={152} shirt={BLUE_LIGHT} hair="long" facing="left" badge />
      <Arm d="M98 40 Q106 54 118 56" hand={[118, 56]} />
      <Arm d="M142 40 Q134 54 122 56" color={BLUE_LIGHT} hand={[122, 56]} />
      <g className="scene-shake">
        <circle cx={120} cy={56} r={4.6} fill={SKIN} stroke={BLUE} strokeWidth={1.2} />
      </g>
      {[
        { x: 120, y: 18, d: 0 },
        { x: 104, y: 30, d: 0.5 },
        { x: 136, y: 30, d: 1 },
      ].map((s) => (
        <path
          key={s.d}
          className="scene-twinkle"
          style={{ animationDelay: `${s.d}s` }}
          d={`M${s.x} ${s.y - 6}l1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2-4.2-1.8 4.2-1.8z`}
          fill={BLUE}
        />
      ))}
    </Scene>
  );
}

/** Open: an open door with light spilling out, and a person waiting beside it to welcome someone in. */
export function OpenScene() {
  return (
    <Scene label="An open door and a person waiting to welcome a new hire">
      <g className="scene-sign">
        <path d="M34 22V12" stroke={BLUE} strokeWidth={2} />
        <rect x={10} y={22} width={48} height={20} rx={5} fill="#fff" stroke={BLUE} strokeWidth={2} />
        <text x={34} y={36} textAnchor="middle" fontSize={10.5} fontWeight={800} fill={BLUE}>
          OPEN
        </text>
      </g>
      <rect x={72} y={10} width={56} height={73} rx={3} fill="#fff" stroke={BLUE} strokeWidth={3} />
      <path className="scene-glow" d="M76 14h48v69H76z" fill={PALE} />
      <path className="scene-glow" d="M128 83 L168 83 L150 62 L128 42z" fill={PALE} opacity={0.7} />
      <rect className="scene-door" x={76} y={14} width={48} height={69} fill={BLUE} />
      <circle cx={114} cy={50} r={2.5} fill="#fff" />
      <Person x={178} shirt={BLUE_LIGHT} hair="long" facing="left" />
      {/* arm held out towards the door, inviting someone in */}
      <g transform="translate(168 39)">
        <g className="scene-invite">
          <path d="M0 0 Q-9 6 -16 4" stroke={BLUE_LIGHT} strokeWidth={5.5} strokeLinecap="round" fill="none" />
          <circle cx={-17} cy={4} r={3.4} fill={SKIN} stroke={BLUE_LIGHT} strokeWidth={0.8} />
        </g>
      </g>
    </Scene>
  );
}
