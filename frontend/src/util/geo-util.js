import { geoCentroid, geoBounds } from "d3-geo";
import { merge } from "topojson-client";

const topojson = window.topojson;
const geo = topojson.objects[Object.keys(topojson.objects)[0]];

export const getBounds = (selected = []) => {
  const geoFilter = geo.geometries.filter((x) => {
    const filters = [];
    selected.forEach((s) => {
      if (x?.properties?.[s.prop] === s.value) {
        filters.push(true);
      } else {
        filters.push(false);
      }
    });
    return filters?.filter((f) => f).length === selected.length;
  });
  const mergeTopo = merge(
    topojson,
    geoFilter.length ? geoFilter : geo.geometries
  );
  const center = geoCentroid(mergeTopo).reverse();
  const bounds = geoBounds(mergeTopo);
  const bbox = [bounds[0].reverse(), bounds[1].reverse()];
  return {
    coordinates: center,
    bbox: bbox,
  };
};
