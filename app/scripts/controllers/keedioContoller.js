'use strict';
/**
 * @ngdoc function
 * @name sbAdminApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the sbAdminApp
 */
var myApp = angular.module('sbAdminApp', ['elasticsearch', 'nvd3', 'fqueue']);

myApp.controller('KeedioCtrl', ['$scope', 'FixedQueue', function ($scope, FixedQueue) {

    var pieChart;

    var queryToES = '{ \
        "query": { \
            "match_all": {} \
        }, \
        "aggs": { \
            "max_balance" : { "max":{"field":"balance"}}, \
            "min_balance" : { "min":{"field":"balance"}}, \
            "balance_histogram": { \
                "histogram" : { \
                    "field" : "balance", \
                    "interval" : 5000, \
                    "extended_bounds" : { \
                        "min" : 0, \
                        "max" : 50000 \
                    } \
                } \
            } \
        } \
    }';

    var queryToESHistAge = '{ \
        "query": { \
            "range": { \
               "balance": { \
                  "from": from_replace, \
                  "to": to_replace \
               } \
            } \
        }, \
        "aggs": { \
            "age_histogram": { \
                "histogram" : { \
                    "field" : "age", \
                    "interval" : 1 \
                } \
            } \
        } \
    }';

    var client = new elasticsearch.Client({
        host: 'ambari9:9200',
        log: 'trace'
    });

    $scope.doFirst = function (){

        var docs = client.search({
            index: 'bank',
            body: queryToES
        }).then(function (body) {
            var aggs = body.aggregations;
            $scope.clients = body.hits.total;
            $scope.maxbalance = aggs.max_balance.value;
            $scope.minbalance = aggs.min_balance.value;

            var data = body.aggregations.balance_histogram.buckets;
            createBarChart(data);

        }, function (error) {
            console.trace(error.message);
        });   

        try {
            var dataSerie = FixedQueue(20, []);
        } catch (err) {
            log.console(err);
        }

        doRealTime();

    }

    function doRealTime() {
        var timeSerie;
        var dataSerie;
        var dataSerie2;
        var dataSerie3;
        var dataSerie4;

        try {
            timeSerie = FixedQueue(20, []);
            dataSerie = FixedQueue(20, []);
            dataSerie2 = FixedQueue(20, []);
            dataSerie3 = FixedQueue(20, []);
            dataSerie4 = FixedQueue(20, []);
        } catch (err) {
            log.console(err);
        }
        


        var chart = c3.generate({
            bindto: '#real-time',
            data: {
                x: 'x',
                xFormat: '%Y-%m-%d %H:%M:%S',
                columns: [
                    timeSerie,
                    dataSerie,
                    dataSerie2,
                    dataSerie3,
                    dataSerie4,
                ],
                type: 'line',
                types: {
                    dataSerie2: 'spline',
                    dataSerie3: 'area',
                    dataSerie4: 'bar',
                }                
            },
            transition: {
                duration: 0,
            },
            axis: {
                x: {
                    type: 'timeseries',
                    tick: {
                        format: '%Y-%m-%d %H:%M:%S',
                    }
                }
            }
        });

        
        setInterval(function () {
            var formatter = d3.time.format("%Y-%m-%d %H:%M:%S");
            var date = new Date();
            timeSerie.push(formatter(date));
            dataSerie.push(Math.floor(Math.random() * 100) + 1);
            dataSerie2.push(Math.floor(Math.random() * 100) + 1);
            dataSerie3.push(Math.floor(Math.random() * 100) + 1);
            dataSerie4.push(Math.floor(Math.random() * 100) + 1);
            timeSerie.splice(0,1,'x');
            dataSerie.splice(0,1,'dataSerie');
            dataSerie2.splice(0,1,'dataSerie2');
            dataSerie3.splice(0,1,'dataSerie3');
            dataSerie4.splice(0,1,'dataSerie4');
            chart.load({
                columns: [
                    timeSerie,
                    dataSerie,
                    dataSerie2,
                    dataSerie3,
                    dataSerie4
                ]
            });
        }, 1000);
    }

    function createBarChart(data) {

        //Line chart data should be sent as an array of series objects.
        var balance = ['Balance'];
        var xLabels = ['x'];

        for (var i=0; i<data.length; i++) {
            balance.push(data[i].doc_count);
            xLabels.push((i+1)*5000);
        }

        // Pintamos el barchart
        var chart = c3.generate({
            bindto: '#bar-chart',
            data: {
                x: 'x',
                columns: [ xLabels, balance ],
                type: 'bar',
                onclick: function (d, element) { 
                    console.log("Clicked: " + d.value + "," + element);
                    createPieChart(xLabels[d.x + 1]);
                }
            },
            bar: {
                width: {
                    ratio: 0.5 // this makes bar width 50% of length between ticks
                }
                // or
                //width: 100 // this makes bar width 100px
            },
            axis: {
                x: {
                    type: 'category'
                }
            }
        });


    };

    function createPieChart(index) {

        try {
            pieChart.destroy();
        } catch(err){
            console.log("Chart no creado")
        }

        var q = queryToESHistAge.replace('from_replace', index - 5000).replace('to_replace', index);

        var docs = client.search({
            index: 'bank',
            body: q
        }).then(function (body) {
            var aggs = body.aggregations;

            var data = body.aggregations.age_histogram.buckets;
            var allData = [];

            for (var i=0;i<data.length;i++) {
                var aux = [data[i].key, data[i].doc_count];

                allData.push(aux);
            }

            pieChart = c3.generate({
                bindto: '#pie-chart',
                data: {
                    columns: allData,
                    type : 'donut',
                    onclick: function (d, i) { console.log("onclick", d, i); },
                    onmouseover: function (d, i) { console.log("onmouseover", d, i); },
                    onmouseout: function (d, i) { console.log("onmouseout", d, i); }
                },
                donut: {
                    title: "Age distribution"
                }
            });

            console.log("Tamaño del array: " + data.length);            
            console.log("Done");

        }, function (error) {
            console.trace(error.message);
        });           
    };

}]);