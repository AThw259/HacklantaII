import {classifyCrime} from './crime.js?v=crime-2';
import {distance, distanceToRoute} from './scoring.js?v=havens-2';
export const sources={
 lighting:'https://services5.arcgis.com/5RxyIIJ9boPdptdo/ArcGIS/rest/services/COA_Street_lights/FeatureServer/0',
 crime:'https://services3.arcgis.com/Et5Qfajgiyosiw4d/arcgis/rest/services/OpenDataWebsite_Crime_view/FeatureServer/0'
};
async function query(url,params){
 const response=await fetch(url+'/query?'+new URLSearchParams({f:'json',...params}),{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('ArcGIS unavailable');
 const data=await response.json();if(data.error)throw new Error('ArcGIS query failed');return data;
}
async function features(url,params){
 const all=[];
 for(let offset=0;offset<10000;offset+=1000){
  const data=await query(url,{...params,resultOffset:offset,resultRecordCount:1000});
  if(!Array.isArray(data.features))throw new Error('Invalid ArcGIS response');
  all.push(...data.features);
  if(!data.exceededTransferLimit)return all;
  if(!data.features.length)throw new Error('Incomplete ArcGIS response');
 }
 throw new Error('ArcGIS result too large');
}
const position=f=>[f.geometry?.y,f.geometry?.x];
export function lightingEvidence(route,features){
 const lights=features.map(position).filter(p=>p.every(Number.isFinite)&&distanceToRoute(p,route.points)<=50);
 if(!lights.length)return {note:'Lighting unknown: no city-owned inventory points nearby.'};
 let total=0,covered=0;
 for(let i=1;i<route.points.length;i++){
  const a=route.points[i-1],b=route.points[i],length=distance(a,b),n=Math.max(1,Math.ceil(length/25));
  for(let j=0;j<n;j++){
   const t=(j+.5)/n,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];total+=length/n;
   if(lights.some(l=>distance(l,p)<=50))covered+=length/n;
  }
 }
 const fraction=total?covered/total:0;
 // Inventory presence is a proxy, not measured illumination or working status.
 const lighting=fraction>=.8?'very_well_lit':fraction>=.5?'good':fraction>=.2?'some':undefined;
 return {lighting,note:`Mapped-light proximity: ${Math.round(fraction*100)}% of route within 50 m; operation unverified.${lighting?'':' Insufficient inventory coverage to classify lighting.'}`};
}
export function crimeEvidence(route,features,now=Date.now()){
 const incidents=new Map();
 const day=86400000;
 let expiredByLevel=0;
 let unclassifiedWithin30Days=0;

 for(const f of features){
  const a=f.attributes||{},p=position(f),age=now-a.ReportDate;
  const routeDistance=p.every(Number.isFinite)?distanceToRoute(p,route.points):Infinity;
  if(!Number.isFinite(a.ReportDate)||age<0||age>30*day||!p.every(Number.isFinite)||routeDistance>150)continue;

  const id=a.IncidentNumber||a.OBJECTID;
  if(id==null)continue;

  const offense=classifyCrime(a);
  if(!offense){
   unclassifiedWithin30Days++;
   continue;
  }

  // Use a severity-specific time window:
  // levels 1-2 => 7 days, level 3 => 14 days, levels 4-5 => 30 days.
  if(age>offense.lookbackDays*day){
   expiredByLevel++;
   continue;
  }

  const candidate={
   offense,
   position:p,
   reportDate:a.ReportDate,
   routeDistance,
   label:String(a.NIBRS_Offense||offense.type||'Crime report')
  };

  const previous=incidents.get(id);
  // If one incident contains several eligible offenses, count only the
  // highest-risk offense (largest level / most negative point value).
  if(!previous || offense.level>previous.offense.level)incidents.set(id,candidate);
 }

 const known=[...incidents.values()];
 const crimePoints=known.length?known.reduce((sum,item)=>sum+item.offense.points,0):undefined;
 const counts={};for(const item of known)counts[item.offense.type]=(counts[item.offense.type]||0)+1;
 const crimeIncidents=known
  .sort((a,b)=>a.routeDistance-b.routeDistance||b.reportDate-a.reportDate)
  .slice(0,8)
  .map(item=>({
   type:item.offense.type,
   level:item.offense.level,
   label:item.label,
   points:item.offense.points,
   position:item.position,
   routeDistance:item.routeDistance,
   reportDate:item.reportDate,
   daysAgo:Math.max(0,Math.floor((now-item.reportDate)/day))
  }));

 const windowSummary='Levels 1-2 use 7 days; level 3 uses 14 days; levels 4-5 use 30 days.';
 return {
  crimePoints,
  crimeCount:known.length,
  crimeCounts:counts,
  crimeIncidents,
  note:`${known.length} eligible distinct incidents within 150 m. Raw crime penalty: ${crimePoints??'unknown'} (route score applies a maximum -25 crime deduction). ${windowSummary} ${Object.entries(counts).map(([type,n])=>`${type.replaceAll('_',' ')}: ${n}`).join(', ')}${expiredByLevel?` ${expiredByLevel} older low/moderate-severity records were outside their scoring window.`:''}${unclassifiedWithin30Days?` ${unclassifiedWithin30Days} unclassified records were not scored.`:''} Highest eligible risk level per incident; report dates used.`
 };
}
export async function loadRouteEvidence(routes,now=Date.now()){
 const points=routes.flatMap(r=>r.points),lats=points.map(p=>p[0]),lons=points.map(p=>p[1]);
 const geometry=JSON.stringify({xmin:Math.min(...lons)-.003,ymin:Math.min(...lats)-.002,xmax:Math.max(...lons)+.003,ymax:Math.max(...lats)+.002,spatialReference:{wkid:4326}});
 const shared={geometry,geometryType:'esriGeometryEnvelope',inSR:4326,outSR:4326,spatialRel:'esriSpatialRelIntersects',returnGeometry:true};
 const date=n=>new Date(n).toISOString().slice(0,19).replace('T',' ');
 const results=await Promise.allSettled([
  features(sources.lighting,{...shared,where:'1=1',outFields:'OBJECTID_1',orderByFields:'OBJECTID_1 ASC'}),
  features(sources.crime,{...shared,where:`ReportDate >= TIMESTAMP '${date(now-30*86400000)}' AND ReportDate <= TIMESTAMP '${date(now)}'`,outFields:'OBJECTID,IncidentNumber,ReportDate,NibrsUcrCode,NIBRS_Offense',orderByFields:'OBJECTID ASC'})
 ]);
 return routes.map(route=>{
  const light=results[0].status==='fulfilled'?lightingEvidence(route,results[0].value):{note:'Streetlight data unavailable or incomplete; lighting unknown.'};
  const crime=results[1].status==='fulfilled'?crimeEvidence(route,results[1].value,now):{note:'Crime data unavailable or incomplete; crime unknown.'};
  return {...route,evidence:{
   lighting:light.lighting,
   crimePoints:crime.crimePoints,
   crimeCount:crime.crimeCount,
   crimeCounts:crime.crimeCounts,
   crimeIncidents:crime.crimeIncidents
  },dataNotes:[light.note,crime.note]};
 });
}
