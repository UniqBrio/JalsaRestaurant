/**
 * The reference screen - the one route the starter ships, and the subject of every functional
 * spec under tests/functional/.
 *
 * It is thin on purpose: it mounts the feature. The list, the form, the archive confirmation
 * and the wiring between them live in src/features/items/, where they are testable without a
 * browser. A route file that grew logic would be logic only a browser could reach.
 */
import { ItemsScreen } from '../features/items/ItemsScreen';

export default function Page() {
  return <ItemsScreen />;
}
