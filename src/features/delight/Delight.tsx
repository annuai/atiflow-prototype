import { EggLayer } from './RobotEgg';
import { Triggers } from './Triggers';

/** Mounted once by the app shell: draws the easter eggs and listens for what sets them off. */
export function Delight() {
  return (
    <>
      <EggLayer />
      <Triggers />
    </>
  );
}
