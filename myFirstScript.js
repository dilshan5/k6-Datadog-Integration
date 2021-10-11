import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

// if your response code is not  between 200-299, then this script mark it as a FAILED request.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }));

// here you set the ramp-up load and durations
export let options = {
    scenarios: {
        contacts: {
            executor: 'ramping-arrival-rate',
            preAllocatedVUs: 2500, // how large the initial pool of VUs would be
            maxVUs: 4000, // if the preAllocatedVUs are not enough, we can initialize more
            stages: [
                { duration: '5m', target: 500 }, // simulate ramp-up of traffic from 1 to 100 users over 5 minutes.
                { duration: '10m', target: 500 }, // stay at 100 users for 10 minutes
                { duration: '5m', target: 1000 },
                { duration: '10m', target: 1000 },
                { duration: '5m', target: 1500 },
                { duration: '10m', target: 1500 },
                { duration: '5m', target: 2000 },
                { duration: '15m', target: 2000 },
                { duration: '5m', target: 2500 },
                { duration: '120m', target: 2500 },
                { duration: '5m', target: 2000 },
                { duration: '15m', target: 2000 },
                { duration: '5m', target: 1500 },
                { duration: '10m', target: 1500 },
                { duration: '5m', target: 1000 },
                { duration: '10m', target: 1000 },
                { duration: '5m', target: 500 },
                { duration: '10m', target: 500 },
                { duration: '5m', target: 0 },
            ]
        },
    },
};

let params = {
    headers: { 'Authorization': 'Bearer access-token' },
};

//Create Trend metrics for your network hop calculations
//https://k6.io/docs/javascript-api/k6-metrics/trend/
let targetResponseTimeTrend = new Trend('target_response_time');
let requestProcessingTimeTrend = new Trend('request_processing_time');
let responseProcessingTimeTrend = new Trend('response_processing_time');
let forwardProxyToPlatformLatencyTrend = new Trend('forwardProxy_to_Platform_time');
let plaformToforwardProxyLatencyTrend = new Trend('platform_to_forwardProxy_time');
let backendServerProcessingLatencyTrend = new Trend('backend_server_processing_time');
let plaformToReverseProxyLatencyTrend = new Trend('plaformToReverseProxyLatency');
let reverseProxyToBackendLatencyTrend = new Trend('reverseProxyToBackendLatency');
let backendToReverseProxyLatencyTrend = new Trend('backendToReverseProxyLatency');
let reverseProxyToPlatformLatencyTrend = new Trend('reverseProxyToPlatformLatency');

export default function () {
    let res = http.get('https://www.google.com', params, { timeout: "100s" });

    let targetResponseTime = 0;
    let requestProcessingTime = 0;
    let responseProcessingTime = 0;
    let forwardProxyToPlatformLatency = 0;
    let plaformToReverseProxyLatency = 0;
    let reverseProxyToBackendLatency = 0;
    let backendToReverseProxyLatency = 0;
    let reverseProxyToPlatformLatency = 0;
    let plaformToForwardProxyLatency = 0;
    let backendInTime = 0;
    let backendOutTime = 0;
    let backendServerProcessingLatency = 0;

    //get the latency values from the response headers
    targetResponseTime = res.headers["Targetresponsetime"];
    requestProcessingTime = res.headers["Requestprocessingtime"];
    responseProcessingTime = res.headers["Responseprocessingtime"];
    forwardProxyToPlatformLatency = res.headers["ForwardProxyToPlatformLatency"];
    plaformToForwardProxyLatency = res.headers["PlaformToforwardProxyLatency"];

    plaformToReverseProxyLatency = res.headers["PlaformToReverseProxyLatency"];
    reverseProxyToBackendLatency = res.headers["ReverseProxyToBackendLatency"];
    backendToReverseProxyLatency = res.headers["BackendToReverseProxyLatency"];
    reverseProxyToPlatformLatency = res.headers["ReverseProxyToPlatformLatency"];

    //calculate the backend processing time  
    backendInTime = res.headers["Be-In-Time"];
    backendOutTime = res.headers["Be-Out-Time"];
    backendServerProcessingLatency = backendOutTime - backendInTime;

    if (targetResponseTime == undefined) {
        targetResponseTime = 0;
    }
    if (requestProcessingTime == undefined) {
        requestProcessingTime = 0;
    }
    if (responseProcessingTime == undefined) {
        responseProcessingTime = 0;
    }
    if (forwardProxyToPlatformLatency == undefined) {
        forwardProxyToPlatformLatency = 0;
    }
    if (backendOutTime == undefined) {
        backendServerProcessingLatency = 0;
    }
    if (plaformToForwardProxyLatency == undefined) {
        plaformToForwardProxyLatency = 0;
    }

    //assign the latency value for the respective Trend metric
    requestProcessingTimeTrend.add(Math.abs(requestProcessingTime));
    responseProcessingTimeTrend.add(Math.abs(responseProcessingTime));
    targetResponseTimeTrend.add(Math.abs(targetResponseTime));
    forwardProxyToPlatformLatencyTrend.add(Math.abs(forwardProxyToPlatformLatency));
    plaformToforwardProxyLatencyTrend.add(Math.abs(plaformToForwardProxyLatency));
    backendServerProcessingLatencyTrend.add(Math.abs(backendServerProcessingLatency));
    plaformToReverseProxyLatencyTrend.add(Math.abs(plaformToReverseProxyLatency));
    reverseProxyToBackendLatencyTrend.add(Math.abs(reverseProxyToBackendLatency));
    backendToReverseProxyLatencyTrend.add(Math.abs(backendToReverseProxyLatency));
    reverseProxyToPlatformLatencyTrend.add(Math.abs(reverseProxyToPlatformLatency));


    // add a check to validate your response
    // if the check failed, then print the response header and Body
    let passed = check(res, {
        'Response body size is 50 KB': (r) => r.body && r.body.length > 50000,
    });

    if (!passed) {
        printResponse(res);
    }

}

//print the error response to the console
// Both response headers and body will be in one JSON object
function printResponse(response) {
    let responseHeaders = JSON.stringify(response.headers);
    let fullResponse = `{"error_code ": ${response.error_code}, "non_http_error ": ${response.error}, "status_text ": ${response.status_text}, ${responseHeaders}, ${response.body}}`;
    console.log(JSON.stringify(fullResponse));
    console.log('\n');
}


//this will export default k6 console results as a HTML file
export function handleSummary(data) {
    return {
        "summary.html": htmlReport(data),
    };
}


