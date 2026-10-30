/* Shared field geometry. B is returned as cB so E and B can use independent visual scales. */
(function(root){
'use strict';
const TAU=2*Math.PI;
function field(theta,amplitude,circular){
 const ey=amplitude*Math.sin(theta),ez=circular?amplitude*Math.cos(theta):0;
 return {ey,ez,by:-ez,bz:ey}; // cB = x-hat cross E; E cross B always points along +x.
}
function phaseRadius(time,speed,lambda,phi){
 // Outgoing shells are the maxima sin(theta)=1: theta=2π(ft-r/λ)+phi.
 const offset=speed*time+lambda*(phi/TAU-.25);
 return ((offset%lambda)+lambda)%lambda;
}
const api={field,phaseRadius};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.WavePhysics=api;
})(typeof window==='undefined'?globalThis:window);
