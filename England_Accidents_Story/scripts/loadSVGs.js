
const myevent = new Event('svgsLoaded');
var vehicles_loaded = 0;
// function onLoadSVG(x) {
    // SVGInject(x, {'afterInject': (img, svg) => {
        // vehicles_loaded++; 
        // if (vehicles_loaded == 6) {
            // document.dispatchEvent(myevent);
        // }       
    // }});
// }

document.addEventListener('DOMContentLoaded', (event) => {
    document.getElementById("VehicleViz").querySelectorAll("img").forEach(x => {
        SVGInject(x, {'afterInject': (img, svg) => {
            vehicles_loaded++; 
            if (vehicles_loaded == 6) {
                document.dispatchEvent(myevent);
            }       
        }});
        
    });  
})