import type {EurR1Family,R1Component,R1Profile} from './contracts'

const rate=(id:string,seriesId:string,label:string,weight:number,period:R1Component['period']='month',polarity:1|-1=1):R1Component=>({id,seriesId,label,weight,period,polarity,unit:'pp',units:[1],multiplier:0,changeLabel:`${label} changed`})
const profile=(family:EurR1Family,label:string,category:R1Profile['category'],components:R1Component[],alternatives:number[][],extra:Partial<R1Profile>={}):R1Profile=>({family,label,category,components,alternatives,version:`EUR-${family.toUpperCase()}-R1`,currency:'EUR',country:'EU',...extra})
const pmi=(family:EurR1Family,releaseFamily:string,seriesId:string,label:string,country:string)=>profile(family,label,'activity',[{...rate('activity',seriesId,label,100),unit:'pts',units:[0]}],[[100]],{releaseFamily,country})
export const eurR1Profiles:Record<EurR1Family,R1Profile>={
  'euro-inflation':profile('euro-inflation','Euro-area HICP','inflation',[rate('core-annual','999030012','Core HICP y/y',50),rate('headline-annual','999030013','HICP y/y',50)],[[50,50],[60,40],[40,60]]),
  'german-inflation':profile('german-inflation','German HICP','inflation',[rate('headline-annual','276010023','HICP y/y',100)],[[100]],{country:'DE'}),
  'euro-pmi':pmi('euro-pmi','euro-pmi','999500003','Euro-area composite PMI','EU'),
  'euro-services-pmi':pmi('euro-services-pmi','euro-pmi','999500002','Euro-area services PMI','EU'),
  'euro-manufacturing-pmi':pmi('euro-manufacturing-pmi','euro-pmi','999500001','Euro-area manufacturing PMI','EU'),
  'german-pmi':pmi('german-pmi','german-pmi','276500003','German composite PMI','DE'),
  'german-services-pmi':pmi('german-services-pmi','german-pmi','276500002','German services PMI','DE'),
  'german-manufacturing-pmi':pmi('german-manufacturing-pmi','german-pmi','276500001','German manufacturing PMI','DE'),
  'french-pmi':pmi('french-pmi','french-pmi','250500003','French composite PMI','FR'),
  'french-services-pmi':pmi('french-services-pmi','french-pmi','250500002','French services PMI','FR'),
  'french-manufacturing-pmi':pmi('french-manufacturing-pmi','french-pmi','250500001','French manufacturing PMI','FR'),
  'euro-labor':profile('euro-labor','Euro-area unemployment','labor',[rate('unemployment','999030020','Unemployment rate',100,'month',-1)],[[100]]),
  'euro-employment':profile('euro-employment','Euro-area employment','labor',[rate('employment-quarterly','999030001','Employment q/q',80,'quarter'),rate('employment-annual','999030002','Employment y/y',20,'quarter')],[[80,20],[70,30],[100,0]],{releaseFamily:'euro-labor',calibrationMinimum:24}),
  // Total labour cost already includes wages: display wages separately, score it
  // once. Do not add the overlapping total cost as another inflation vote.
  'euro-wages':profile('euro-wages','Euro-area wage costs','inflation',[rate('wages','999030023','Wage costs y/y',100,'quarter')],[[100]],{calibrationMinimum:24}),
  'euro-gdp':profile('euro-gdp','Euro-area GDP','activity',[rate('growth','999030016','GDP q/q',80,'quarter'),rate('annual-growth','999030017','GDP y/y',20,'quarter')],[[80,20],[70,30],[100,0]],{calibrationMinimum:24}),
  ecb:profile('ecb','ECB action','policy',[{...rate('action','999010006','ECB deposit rate',100,'action'),unit:'bp'}],[[100]]),
}
