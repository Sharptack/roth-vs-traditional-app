// The three-scenario Visualization page's background worker: runs one grid point at a time, as
// asked by ThreeWayPage.jsx, so the page stays responsive.
import { threeWayPoint } from '../lib/threeWay.js';

self.onmessage = ({ data }) => {
  const { id, point, year } = data;
  self.postMessage({ id, out: threeWayPoint(point, year) });
};
