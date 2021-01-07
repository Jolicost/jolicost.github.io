
// Region: Utils
String.prototype.format = function() {
  a = this;
  for (k in arguments) {
    a = a.replace("{" + k + "}", arguments[k])
  }
  return a
}

function get_RectColorByValue(severity_index) {
    var index = Math.min(100, severity_index * 2)
    return colorGradient(index / 100, colorStart, colorMed, colorEnd)
    //return "hsl({0}, 100%, {1}%)".format(yellowHsl, 50 + (50 - Math.min(parseInt(severity_index),50)))
}

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatHourName(hourStr) {
    return "{0}:00-{1}:00".format(parseInt(hourStr),parseInt(hourStr)+1)
}

function create_defaults(data, categories) {
    categories.forEach(man => {
        if (!data[man]) {
            data[man] = [0,0]
        }
    });
    
    return data;
}

function colorGradient(fadeFraction, rgbColor1, rgbColor2, rgbColor3) {
    var color1 = rgbColor1;
    var color2 = rgbColor2;
    var fade = fadeFraction;

    // Do we have 3 colors for the gradient? Need to adjust the params.
    if (rgbColor3) {
      fade = fade * 2;

      // Find which interval to use and adjust the fade percentage
      if (fade >= 1) {
        fade -= 1;
        color1 = rgbColor2;
        color2 = rgbColor3;
      }
    }

    var diffRed = color2.red - color1.red;
    var diffGreen = color2.green - color1.green;
    var diffBlue = color2.blue - color1.blue;

    var gradient = {
      red: parseInt(Math.floor(color1.red + (diffRed * fade)), 10),
      green: parseInt(Math.floor(color1.green + (diffGreen * fade)), 10),
      blue: parseInt(Math.floor(color1.blue + (diffBlue * fade)), 10),
    };

    return 'rgb(' + gradient.red + ',' + gradient.green + ',' + gradient.blue + ')';
}

const colorEnd = {
    red: 255,
    green: 0,
    blue: 0 
}
const colorMed = {
    red: 255,
    green: 217,
    blue: 0
}
const colorStart = {
    red: 255,
    green: 255,
    blue: 255
}

const routeMaxDistancePoint = 500;

const colorStartHex = '#ff0000';
const colorEndHex = '#ffffff';

// Region: Constants and globals
const yellowHsl = 0;
const yellowColorHex = "#cc0000";
//const dataSrc = "data/Accidents_1000_cleaned.csv";
const dataSrc = "data/Accidents_categorical_cleaned.csv";

var selectedHours = [];
var selectedWeekDays = [];
var selectedAges = [];
var selectedVehicles = [];

const manoeuvre_categories = ['Going ahead', 'Turning left', 'Turning right',  'Slowing or stopping', 'Parked', 'Waiting to go','Moving off', 'Changing lane','U-turn', 'Overtaking', 'Reversing'];
const intersection_categories = ['Not at or within 20 metres of junction', 'Approaching junction or waiting/parked at junction approach', 'Mid Junction - on roundabout or on main road','Cleared junction or waiting/parked at junction exit','Entering roundabout', , 'Leaving roundabout',, 'Entering main road','Leaving main road','Entering from slip road' ];
const impact_categories = ['Front', 'Offside', 'Nearside', 'Back', 'Did not impact'];
const vehicle_categories = ['Car', 'Motorcycle', 'Van', 'Taxi', 'Bus/minibus','Other'];

const defaults = {
    'Vehicle_Manoeuvre': manoeuvre_categories,
    'Junction_Location': intersection_categories,
    'X1st_Point_of_Impact': impact_categories,
    'Vehicle_Category': vehicle_categories
}

const svgMapping = {
    'Approaching junction or waiting/parked at junction approach':'Approaching junction',
    'Cleared junction or waiting/parked at junction exit': 'Cleared junction'
}
const selectOpacityMs = 50;
const selectOpacity = '0.85';
// Popup
const popupPieChartSize = 100;

var ageMap = {
    1: '16-20',
    2: '21-25',
    3: '26-35',
    4: '36-45',
    5: '46-55',
    6: '56-65',
    7: '66-75',
    8: '>75'    
}

var accidents_data = undefined;

function getAccidentsDataCopy() {
    return Array.from(accidents_data);
}
// Region: Charts

// Creates a popup with a piechart inside based on the severity index of the element
function AttachPiechartPopup(hover_elements, data_selector_func, alias_func) {
    
    var popup_div = d3.select("div#hidden_popup")
        .style("opacity", 0);
        
        
    hover_elements
    .on('mouseover', function(d,i) {
        // Change opacity of the hovered element
        d3.select(this).transition()
           .duration(selectOpacityMs)
           .attr('opacity', selectOpacity);
         
        // Transition popup to visible
        popup_div.transition()
           .duration(selectOpacityMs)
           .style("opacity", 1);
           
        popup_div
            .style("left", (d3.event.pageX + 10) + "px")
            .style("top", (d3.event.pageY - 15) + "px");
          
        // Handle data and alias selectors
        if (data_selector_func === undefined) {
            data_selector_func = (d) => {
                return d;
            };
        }
        
        var data = data_selector_func(d);
        if (alias_func === undefined) {
            alias_func = (d) => {
                return d['name'];
            }
        }
        
        // Update the popup information
        popup_div.select("#popup_info #popup_title").text(alias_func(data));
        popup_div.select("#popup_info #popup_total_accidents").text(numberWithCommas(data['total']));
        popup_div.select("#popup_info #popup_major_accidents").text(numberWithCommas(data['major']));
        popup_div.select("#popup_info #popup_severity_index").text("{0}%".format(Math.round(parseFloat(data['value']))));
        // Update the piechart based on data
        RenderPopupPieChart(popup_div.select("#popup_piechart"), data);
    })
    .on('mouseout', function(d, i) {
        // Transition popup to invisible
        d3.select(this).transition()
            .duration(selectOpacityMs)
            .attr('opacity', '1');
            
        popup_div.transition()
           .duration(selectOpacityMs)
           .style("opacity", 0);
    })
    
}

// Displays the barchart inside the info popup
function RenderPopupPieChart(parent_elem, data) {

    var width = popupPieChartSize
        height = popupPieChartSize
        margin = popupPieChartSize / 20;

    var radius = Math.min(width, height) / 2 - margin

    var svg = parent_elem
      .select("svg")
        .attr("width", width)
        .attr("height", height)
      .select("g")
        .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

    var data = {major:data['major'], slight:data['total']-data['major']}

    var color = d3.scaleOrdinal()
      .domain(data)
      .range([colorStartHex,colorEndHex])

    var pie = d3.pie()
      .value(d => d.value)
    var data_ready = pie(d3.entries(data))

    // Remove previous piechart
    svg.selectAll("path").remove();
    
    svg
      .selectAll('piechart')
      .data(data_ready)
      .enter()
      .append('path')
      .attr('d', d3.arc()
        .innerRadius(0)
        .outerRadius(radius)
      )
      .attr('fill', d => color(d.data.key))
      .attr("stroke", "black")
      .style("stroke-width", "1px")
      .style("opacity", 1)
}

function barPlotVertical(data, selector) {
    // set the dimensions and margins of the graph
    var margin = {top: 30, right: 30, bottom: 70, left: 60},
        width = 624 - margin.left - margin.right,
        height = 624 - margin.top - margin.bottom;

    // append the svg object to the body of the page
    var svg = d3.select(selector)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");
    // X axis
    var x = d3.scaleBand()
        .range([ 0, width ])
        .domain(data.map(function(d) { return d['text']; }))
        .padding(0.2);

    

    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .attr("class","barPltAxis")
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "translate(30,0)")
        .style("text-anchor", "end");

    // Add Y axis
    var y = d3.scaleLinear()
        .domain([0, 50])
        .range([ height, 0]);
    svg.append("g")
        .attr("class","barPltAxis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + "%"));

    // Bars
    svg.selectAll("mybar")
        .data(data)
        .enter()
        .append("rect")
        .attr("x", d => x(d['text']))
        .attr("y", d => y(d['value']))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d['value']))
        .attr("fill", "#69b3a2")

    svg.selectAll("rect")
        .attr("fill", (d, i) => {
            return get_RectColorByValue(d['value'])
        })

    AttachPiechartPopup(svg.selectAll("rect"), undefined, d => d['text']);
    
}

function barPlotHorizontal(data, selector) {
    // set the dimensions and margins of the graph
    var margin = {top: 30, right: 30, bottom: 70, left: 60},
        width = 460 - margin.left - margin.right,
        height = 800 - margin.top - margin.bottom;

    // append the svg object to the body of the page
    var svg = d3.select(selector)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");
                
    // Add x axis
    var x = d3.scaleLinear()
        .domain([0, 50])
        .range([ 0, width]);
        
    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .attr("class","barPltAxis")
        .call(d3.axisBottom(x).ticks(5).tickFormat(d => d + "%"))
        .selectAll("text")
        .attr("transform", "translate(15,10)")
        .style("text-anchor", "end");
        
        
    
        
    // y axis
    var y = d3.scaleBand()
        .range([ 0, height ])
        .domain(data.map(function(d) { return d['name']; }))
        .padding(0.2);

    svg.append("g")
        .attr("class","barPltAxis")
        .call(d3.axisLeft(y))
        .selectAll("g.tick")
        .html(d => {
            var file;
            if (svgMapping[d]) {
                file = svgMapping[d];
            } else {
                file = d;
            }
            return '<image transform="translate(-10,0)" class="svg_icon" category="{0}" x="-40" y="-20" width="40" height="40" href="icons/plots/{1}.svg" />'.format(file,file);
        });

    

    

    // Bars
    svg.selectAll("mybar")
        .data(data)
        .enter()
        .append("rect")
        .attr("x", x(0) )
        .attr("y", d => y(d['name']))
        .attr("width", d => x(d['value']))
        .attr("height", y.bandwidth())
        .attr("fill", "#69b3a2")

    svg.selectAll("rect")
        .attr("fill", (d, i) => {
            return get_RectColorByValue(d['value'])
        })

    AttachPiechartPopup(svg.selectAll("rect"));
    
    var popup_div = d3.select("div#icon_popup")
        .style("opacity", 0);
        
    //Our new hover effects
    svg.selectAll("image")
    .on('mouseover', function(d, i) {
        d3.select(this).transition()
           .duration('50')
           .attr('opacity', '.85')
        //Makes the new div appear on hover:
        popup_div.transition()
           .duration(50)
           .style("opacity", 1)
        popup_div
            .style("left", (d3.event.pageX + 10) + "px")
            .style("top", (d3.event.pageY - 15) + "px")
            
        var category = this.attributes["category"].value;
        popup_div.select("b#popup_class_name").text(category); 

    })
    .on('mouseout', function(d, i) {
        d3.select(this).transition()
            .duration('50')
            .attr('opacity', '1')
        //Makes the new div disappear:
        popup_div.transition()
           .duration('50')
           .style("opacity", 0)
    })
    
}

function getXYByImpact(impact, carCenter, carWidth) {
    var x = 0;
    var y = 0;
    if (impact['name'] == 'Front') {
        x = carCenter[0]
        y = carCenter[1] - carWidth / 2;
    } else if (impact['name'] == 'Back') {
        x = carCenter[0] 
        y = carCenter[1] + carWidth / 2; 
    } else if (impact['name'] == 'Nearside') {
        x = carCenter[0] + carWidth / 4;
        y = carCenter[1];
    } else if (impact['name'] == 'Offside') {
        x = carCenter[0] - carWidth / 4;
        y = carCenter[1];
    } else if (impact['name'] == 'Did not impact') {
        x = carCenter[0] - carWidth / 2;
        y = carCenter[1] - carWidth / 2;
    }  
    return [x,y];
}

function ImpactChart(data, selector) {
    // set the dimensions and margins of the graph
    var margin = {top: 30, right: 30, bottom: 30, left: 30},
        width = 936 - margin.left - margin.right,
        height = 624 - margin.top - margin.bottom;

    // append the svg object to the body of the page
    var svg = d3.select(selector)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");


    var carWidth = 400;
    var carHeight = 400;
    var carX = width / 2 - carWidth / 2;
    var carY = height / 2 - carHeight / 2;
    var carCenter = [carX + carWidth / 2, carY + carHeight / 2];
    svg.append("g")
        .html(d => {
            return '<image class="svg_icon" x="0" y="0" width={0} href="icons/car_top.svg" />'.format(carWidth);
            //return '<img id="vehicle_impact_svg" src="icons/car_top.svg"/>'
        })
        .attr("transform","translate({2},{3}), rotate(90,{0},{1})".format(carWidth/2, carWidth/2, carX, carY));
     

    svg.selectAll('circle')
        .data(data)
        .enter()
        .append('circle')
        .style("stroke", "gray")
        .attr("fill", (d, i) => {
            return get_RectColorByValue(d['value'])
        })
        .attr("r", (d,i) => d['value'])
        .attr("cx", (d, i) => {
            return getXYByImpact(d, carCenter, carWidth)[0]
        })
        .attr("cy", (d, i) => {
            return getXYByImpact(d, carCenter, carWidth)[1]
        })
        
    
    AttachPiechartPopup(svg.selectAll("circle"));
}


function DonutChart(data, selector) {
    // set the dimensions and margins of the graph
    var width = 208
        height = 208
        margin = 20

    // The radius of the pieplot is half the width or half the height (smallest one). I subtract a bit of margin.
    var radius = Math.min(width, height) / 2 - margin

    // append the svg object to the div called 'my_dataviz'
    var svg = d3.select(selector)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

    // set the color scale
    var color = d3.scaleOrdinal()
        .domain(data)
        .range([yellowColorHex,"#FFFFFF"])

    // Compute the position of each group on the pie:
    var pie = d3.pie(data)
        .value(function(d) {return 1; })
    var data_ready = pie(data)
    
    // Build the pie chart: Basically, each part of the pie is a path that we build using the arc function.
    var arcs = svg
        .selectAll('whatever')
        .data(data_ready)
        .enter();
    
    arcs.append('path')
        .attr('d', d3.arc()
            .innerRadius(radius-20)         // This is the size of the donut hole
            .outerRadius(radius)
        )
        .attr('fill', d => { return get_RectColorByValue(d.data['value']) })

    arcs.append("text")
        .text(function(d, i) { return d.data['hour_2digits'] })
        .attr('font-family',"'PT Sans', sans-serif")
        .attr('font-size','11px')
        .attr('fill',"#ececec")
        .attr("transform", d => {
            var y = (radius + radius/8) * Math.cos(d.startAngle);
            var x = (radius + radius/8) * Math.sin(d.startAngle);
            return "translate(-7,4),translate({0},{1})".format(x,-y);
        })

    AttachPiechartPopup(svg.selectAll("path"), d => d.data, d => d['hour_text']);
    
    clickFilter(svg, 'path', selectedHours, d => { return d.data });
}


function WeekDayChart(data, selector) {
    // set the dimensions and margins of the graph
    // set the dimensions and margins of the graph
    var width = 208
        height = 208
        margin = 20
        
    var margin = {top: 30, right: 0, bottom: 30, left: 20},
        width = width - margin.left - margin.right,
        height = height - margin.top - margin.bottom;

    // append the svg object to the body of the page
    var svg = d3.select(selector)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");

      
    rects = svg.selectAll('weekday')
        .data(data)
        .enter();
        
    rects.append('rect')
        .style("stroke", "gray")
        .attr("fill", (d, i) => {
            return get_RectColorByValue(d['value'])
        })
        .attr("x", 0 )
        .attr("y", (d,i) => { return 50 * i })
        .attr("width", 50)
        .attr("height", 50)
     
    rects.append("text")
        .text(function(d, i) { return d['text'] })
        .attr('fill',"#ececec")
        .attr('font-family',"'PT Sans', sans-serif")
        .attr('font-size','16px')
        .attr("transform", (d,i) => {
            var y = 50 * i + 30;
            var x = 60;
            return "translate({0},{1})".format(x,y);
        })
    
    AttachPiechartPopup(svg.selectAll("rect"), undefined, d => d['text']);
    
    clickFilter(svg, 'rect', selectedWeekDays);
}


function AgeChart(data, selector) {
    // set the dimensions and margins of the graph
    // set the dimensions and margins of the graph
    var width = 208
        height = 500
        margin = 20
        
    var margin = {top: 30, right: 0, bottom: 30, left: 20},
        width = width - margin.left - margin.right,
        height = height - margin.top - margin.bottom;

    // append the svg object to the body of the page
    var svg = d3.select(selector)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");

      
    rects = svg.selectAll('age')
        .data(data)
        .enter();
        
    rects.append('rect')
        .style("stroke", "gray")
        .attr("fill", (d, i) => {
            return get_RectColorByValue(d['value'])
        })
        .attr("x", 0 )
        .attr("y", (d,i) => { return 50 * i })
        .attr("width", 50)
        .attr("height", 50)
     
    rects.append("text")
        .text((d, i)  => { return d['age'] })
        .attr('fill',"#ececec")
        .attr('font-family',"'PT Sans', sans-serif")
        .attr('font-size','16px')
        .attr("transform", (d,i) => {
            var y = 50 * i + 30;
            var x = 60;
            return "translate({0},{1})".format(x,y);
        })
    
    AttachPiechartPopup(svg.selectAll("rect"), undefined, d => d['age']);
    
    clickFilter(svg, 'rect', selectedAges);
}



function VehicleChart(data, selector) {
    
    var container = d3.select(selector)
        .selectAll("svg")
        .data(data)
        .attr("fill",(d) => { 
            return get_RectColorByValue(d['value']);
        })

    AttachPiechartPopup(container);
    
    clickFilter(d3.select(selector), 'svg', selectedVehicles);    
}

function filterData(data) {
    var ret = data;
    if (selectedHours.length > 0 ) {
        ret = data.filter(x => selectedHours.indexOf(x.Hour_of_Day_dn) > -1); 
    }
    
    if (selectedAges.length > 0) {
        ret = ret.filter(x => selectedAges.indexOf(x.Age_of_Driver) > -1);
    }
    
    if (selectedVehicles.length > 0) {
        ret = ret.filter(x => selectedVehicles.indexOf(x.Vehicle_Category) > -1);
    }
    
    if (selectedWeekDays.length > 0) {
        ret = ret.filter(x => selectedWeekDays.indexOf(x.WeekDay_type) > -1);
    }
    
    return ret;
}

// Region: Filters
function resetFilters() {
    document.querySelectorAll('path').forEach(b=>b.removeAttribute('selected'));
    document.querySelectorAll('svg').forEach(b=>b.removeAttribute('selected'));
    document.querySelectorAll('rect').forEach(b=>b.removeAttribute('selected'));
    
    // Must empty the arrays this way or the references are lost inside the event listener functions
    while(selectedHours.length > 0) {
        selectedHours.pop();
    }
    while(selectedWeekDays.length > 0) {
        selectedWeekDays.pop();
    }
    while(selectedAges.length > 0) {
        selectedAges.pop();
    }
    while(selectedVehicles.length > 0) {
        selectedVehicles.pop();
    }
    
    apply_filters();    
}
function apply_filters() {
    showLoadingFilter();
    
    // d3.csv(dataSrc, (data) => {
        // data = filterData(data);
        
        // d3.select("#VehicleManoeuverViz svg").remove();
        // draw_vehicle_manoeuvre(data);
        
        // d3.select("#IntersectionViz svg").remove();
        // draw_intersection(data);
        
        // d3.select("#ImpactViz svg").remove();
        // draw_impact(data);
        
        // updateMap(data);
        // hideLoader();
    // });
    data = getAccidentsDataCopy();
    data = filterData(data);
        
    d3.select("#VehicleManoeuverViz svg").remove();
    draw_vehicle_manoeuvre(data);
    
    d3.select("#IntersectionViz svg").remove();
    draw_intersection(data);
    
    d3.select("#ImpactViz svg").remove();
    draw_impact(data);
    
    updateMap(data);
    hideLoader();
    
    
}

function clickFilter(parent_elem, selector, selected_array, data_selector_func) {

    if (data_selector_func === undefined) {
        data_selector_func = (d) => {
            return d;
        }
    }
    
    parent_elem.selectAll(selector)
    .on('click', function(d, i) {
        var selected = d3.select(this).attr("selected");
        var data = data_selector_func(d);
        var selected;
        if (!selected || selected=='false') {
            d3.select(this).attr("selected",true);
            selected = true;
        } else {
            d3.select(this).attr("selected",false);
            selected = false;
        }
        
        var filter_value = data['name']
        if (selected) {
            selected_array.push(filter_value);
        } else {
            selected_array.splice(selected_array.indexOf(filter_value),1)
        }
        
        apply_filters();
    })    
}

// Region: Load data
function draw_vehicle_category(data) {
    vehicle_category = computeAggregateData(data, 'isMotorcycle');
    vehicle_category.map(x => {
        var name;
        if (parseInt(x['name']) == 1) {
            name = 'Motorcycle';
        } else {
            name = '4-Wheeler';
        }
        x['text'] = name;
    });
    barPlotVertical(vehicle_category,'#VehicleCategoryViz'); 
}

function draw_vehicle_manoeuvre(data) {
    vehicle_manoeuvre = computeAggregateData(data, 'Vehicle_Manoeuvre');
    barPlotHorizontal(vehicle_manoeuvre, "#VehicleManoeuverViz");
}

function draw_intersection(data) {
    intersection = computeAggregateData(data, 'Junction_Location');
    barPlotHorizontal(intersection, "#IntersectionViz");
}

function draw_impact(data) {
    impact = computeAggregateData(data, 'X1st_Point_of_Impact');
    ImpactChart(impact, "#ImpactViz");
}

function draw_weekday(data) {
    weekday = computeAggregateData(data, 'WeekDay_type');
    weekday.map(x => {
        var name;
        if (parseInt(x['name']) == 1) {
            name = 'Weekend day';
        } else {
            name = 'Working day';
        }
        x['text'] = name;
    })
    WeekDayChart(weekday,"#WeekdayViz");    
}

function draw_age(data) {
    age = computeAggregateData(data,'Age_of_Driver') 
    age.map(x => {
        x['age'] = ageMap[parseInt(x['name'])];
    });
    AgeChart(age,"#AgeViz");    
}

function orderCategories(data, orderByVector) {
    var ret = []
    orderByVector.forEach(x => {
        var found = data.find(d => d['name'] == x);
        ret.push(found);        
    }); 
    return ret;    
}

function get_HourPmData(data) {
    data_pm = data.filter(row => parseInt(row.Hour_of_Day_dn) >= 12)
    return get_AggregateData(data_pm,'Hour_of_Day_dn');
}

function get_HourAmData(data) {
    data_am = data.filter(row => parseInt(row.Hour_of_Day_dn) < 12)
    return get_AggregateData(data_am,'Hour_of_Day_dn');
}

function draw_hour(data) {
    hour_pm = get_SeverityIndex(get_HourPmData(data)).sort((x,y) => {return parseInt(x['name']) - parseInt(y['name'])});
    hour_am = get_SeverityIndex(get_HourAmData(data)).sort((x,y) => {return parseInt(x['name']) - parseInt(y['name'])});
    hour_pm.map(x => x['hour_2digits'] = parseInt(x['name']).toString().padStart(2,"0"));
    hour_am.map(x => x['hour_2digits'] = parseInt(x['name']).toString().padStart(2,"0"));
    hour_pm.map(x => x['hour_text'] = formatHourName(x['name']));
    hour_am.map(x => x['hour_text'] = formatHourName(x['name']));
    DonutChart(hour_pm,"#hour_pm_viz");
    DonutChart(hour_am,"#hour_am_viz");
}

function draw_vehicles(data) {
    vehicles = computeAggregateData(data,'Vehicle_Category') 
    VehicleChart(vehicles, "#VehicleViz");
}

function get_AggregateData(data, property) {
    return data.map(x => {
        return {'name':x[property],'isMajor':parseInt(x.IsMajor)};
    }).reduce((acc, elem) => {
        if (acc.hasOwnProperty(elem['name'])) {
            acc[elem['name']][0] += elem['isMajor'];
            acc[elem['name']][1] += 1;
        }
        else {
            acc[elem['name']] = [elem['isMajor'],1];
        }
        return acc;
    }, {});
}

function get_SeverityIndex(data) {
    return Object.entries(data).map(x => {
        var ret = {};
        ret['name'] = String(x[0])
        var divider = 1;
        if (x[1][1] != 0) {
            divider = x[1][1]
        }
        ret['value'] = x[1][0]/divider*100;
        ret['major'] = x[1][0];
        ret['total'] = x[1][1];
        return ret;
    });
}

function computeAggregateData(data, property) {
    var agg = get_AggregateData(data, property);
    if (defaults[property]) {
        agg = create_defaults(agg, defaults[property])
    }
    var si = get_SeverityIndex(agg);
    if (defaults[property]) {
        si = orderCategories(si, defaults[property])
    }
    return si;
}




function update_total(data) {
    var total = data.length;
    var major = data.filter(d => d.IsMajor == 1).length;
    d3.select("b#total_accidents").text(numberWithCommas(total));
    d3.select("b#major_accidents_total").text(numberWithCommas(major));
    d3.select("b#major_percent").text(Math.round(parseFloat(major)/parseInt(total)*100) + "%");
}

const maxBounds = [
    [61.83740481600604, 13.697806728662686],
    [45.39291353647744, -23.43796728664534]
];

var mymap = L.map('map', {'maxBounds': maxBounds}).fitBounds(maxBounds).setView([51.479989708362716, -0.18654850587139404], 5);


function draw_map(data) {
    
    
    L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: 'mapbox/streets-v11',
        tileSize: 512,
        zoomOffset: -1,
        accessToken: 'pk.eyJ1Ijoiam9saXZhY28iLCJhIjoiY2tpcWxhMzM2MDF4NDJwc2NvM3c2amY2NyJ9.R9gdYyyP07vwTfv65xvvIw'
    }).addTo(mymap);

    
    
}

function pDistance(x, y, x1, y1, x2, y2) {

  var A = x - x1;
  var B = y - y1;
  var C = x2 - x1;
  var D = y2 - y1;

  var dot = A * C + B * D;
  var len_sq = C * C + D * D;
  var param = -1;
  if (len_sq != 0) //in case of 0 length line
      param = dot / len_sq;

  var xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  }
  else if (param > 1) {
    xx = x2;
    yy = y2;
  }
  else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  var dx = x - xx;
  var dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

function placeMapPosition(origin, dest) {
    medianLat = dest[0] - origin[0];
    medianLong = dest[1] - origin[1];
    center = [medianLat / 2 + Number(origin[0]), medianLong / 2 + Number(origin[1])];
    dist = Math.sqrt(medianLat**2 + medianLong**2);
    mymap.fitBounds([origin,dest]);
    // const zoom = 20 - Math.min(20,parseInt(Math.log(distToMaters(dist) / Math.log(100))));
    // mymap.setView(center, zoom)
}

function getMapRoutePoints(origin, dest, callBack) {
    requestRoute(origin[0], origin[1], dest[0],dest[1], route => {
        callBack(route);
    });
}

function requestRoute(startLat, startLon, endLat, endLon, callBack) {
    fetch('https://router.project-osrm.org/route/v1/driving/{1},{0};{3},{2}?alternatives=false&steps=true&geometries=polyline&overview=false&annotations=false'.format(startLat,startLon, endLat, endLon))
    .then(response => {
        response.json().then(data => {
            callBack(data.routes[0].legs[0].steps.flatMap(step => {
                //return [step.intersections[0].location[1],step.intersections[0].location[0]];
                return step.intersections.map(i => {
                    return [i.location[1],i.location[0]];
                });
            }));
        })
    });
}

// Approximation without taking into account earth's form for simplification purposes.
function distToMaters(dist) {
    return dist * 1000 * 111.32;
}

function filterPointsWithinDistance(data, segments, distanceMeters) {
    filtered_points = data.filter(x => {
        var latitude = Number(x.Latitude);
        var longitude = Number(x.Longitude);
        for (var i = 0; i < segments.length -1; i++) {
            dist = pDistance(latitude, longitude, segments[i][0], segments[i][1], segments[i+1][0], segments[i+1][1]);
            if (distToMaters(dist) < distanceMeters) {
                return true;
            }
        }
        
        return false;
    });
    
    return filtered_points;
}

function getPopupHtml(row) {
    return "<p>Vehicle: <b>{0}</b></br>Date: <b>{1}</b></br>Manoeuvre: <b>{2}</b></br>Intersection: <b>{3}</b></br>Impact point: <b>{4}</b></p>".format(row.Vehicle_Category, row.Datetime, row.Vehicle_Manoeuvre, row.Junction_Location,row.X1st_Point_of_Impact); 
}

var mapElements = [];

function draw_map_points(origin, dest, data) {    
    getMapRoutePoints(origin, dest, routes => {
        var path = L.polyline(routes, {color: 'blue', opacity: 0.5})
        mapElements.push(path);
        path.addTo(mymap);
        
        points = filterPointsWithinDistance(data, routes, routeMaxDistancePoint);
        
        points.forEach(x => {
            var circle = L.circleMarker([x.Latitude,x.Longitude], {
                fillColor: yellowColorHex,
                fillOpacity: 1,
                radius: 5,
                stroke: true,
                color: 'red',
                width: 1
            }).bindPopup(getPopupHtml(x),{'autoClose':false, 'className':'mapPopup'}).openPopup();
            
            circle.on('mouseover', function (e) {
                this.openPopup();
            });
            circle.on('mouseout', function (e) {
                this.closePopup();
            });
        
            mapElements.push(circle);
            
            circle.addTo(mymap);
        });
        
        placeMapPosition(origin, dest);
    });  
}

function reverseGeocoding(place, callback) {
    const response = fetch('https://nominatim.openstreetmap.org/search?q={0}&place&format=json&polygon=0&addressdetails=0'.format(place))
    .then(response => response.json().then(data => {
        if (data.length > 0) {
        callback({
            'success':true,
            'name': data[0].display_name,
            'coords': [data[0].lat, data[0].lon]            
        })
        }
        else 
        {
            callback({
                'success':false,
                'name':'NOT FOUND!'
            })
        }
    }));  
}

function reverseGeocodingAll(place1, place2, callback) {
    reverseGeocoding(place1, res1 => {
        reverseGeocoding(place2, res2 => {
            callback(res1,res2);            
        });
    })
    
}

function updateMap(data) {
    mapElements.forEach(e => e.remove(mymap));
    mapElements = [];
    
    var origin = d3.select("div#input_origin .input_place").node().value;
    var dest = d3.select("div#input_dest .input_place").node().value;
    
    if (origin && dest) {
        reverseGeocodingAll(origin, dest, (r1,r2) => {
            
            document.getElementById("input_origin_control").value = r1.name;
            document.getElementById("input_dest_control").value = r2.name;
            
            if (r1.success && r2.success) {
                // If data is not set it means it wasn't filtered before for this action
                if (!data) {
                    data = getAccidentsDataCopy()
                    // Select only major accidents
                    data = data.filter(x => x['IsMajor'] == '1');
                    data = filterData(data);
                    draw_map_points(r1.coords, r2.coords, data); 
                }
                else {
                    // If data was filtered before
                    data = data.filter(x => x['IsMajor'] == '1');
                    draw_map_points(r1.coords, r2.coords, data);
                }
            }  
        });  
    }
}

function handleKeyPressInputs() {
    var dest = document.getElementById("input_dest_control");
    var origin = document.getElementById("input_origin_control");
    
    const inputs = [dest, origin]
    inputs.forEach(i => {
        i.addEventListener("keyup", function(event) {
            if (event.keyCode === 13) {
                event.preventDefault();
                updateMap();
            }
        });
    });
}

var closedLegend = false;

function hideLegend() {
    document.getElementById("legend").style.display = "none";
    closedLegend = true;
}

function posY(elm) {
    var test = elm, top = 0;

    while(!!test && test.tagName.toLowerCase() !== "body") {
        top += test.offsetTop;
        test = test.offsetParent;
    }

    return top;
}

function viewPortHeight() {
    var de = document.documentElement;

    if(!!window.innerWidth)
    { return window.innerHeight; }
    else if( de && !isNaN(de.clientHeight) )
    { return de.clientHeight; }

    return 0;
}

function scrollY() {
    if( window.pageYOffset ) { return window.pageYOffset; }
    return Math.max(document.documentElement.scrollTop, document.body.scrollTop);
}

function checkvisible( elm ) {
    var vpH = viewPortHeight(), // Viewport Height
        st = scrollY(), // Scroll Top
        y = posY(elm);

    return (y > (vpH + st));
}

function hideLegendOnScroll() {
    window.onscroll = function() {
        if (closedLegend) return;
        
        const scroll = document.body.scrollTop;
        if (!checkvisible(document.getElementById("map_container"))) {
            document.getElementById("legend").style.display = "none";
        } else {
            document.getElementById("legend").style.display = "block";
        }
    };     
}

document.addEventListener('svgsLoaded', function (e) {
    start()
}, false);


function showLoader() {
    document.getElementById("loading_screen").className += "loading"; 
}

function showLoadingFilter() {
    document.getElementById("loading_screen").className += "loading loading-filter"; 
}

function hideLoader() {
    document.getElementById("loading_screen").classList.remove("loading");  
    document.getElementById("loading_screen").classList.remove("loading-filter");      
}

function start() {
    // Parse the Data
    d3.csv(dataSrc, data => {
        // Store data in global variable
        accidents_data = data
        update_total(data);
        draw_vehicle_category(data); 
        draw_vehicle_manoeuvre(data);
        draw_intersection(data);
        draw_impact(data);
        draw_hour(data);
        draw_weekday(data);
        draw_age(data);
        draw_vehicles(data);
        draw_map(data);
        hideLoader();
    });
    
    handleKeyPressInputs();
    hideLegendOnScroll();
}





