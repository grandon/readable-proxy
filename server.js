var scrape = require("./scrape");
var sanitizeResult = require("./sanitize").sanitizeResult;
var express = require("express");
var pkgInfo = require("./package.json");
var http = require('http');
var urlmod = require('url');

var app = express();
exports.app = app;

app.use(express.static("static"));
app.use(express.static("node_modules/bootstrap/dist/css"));

/**
 * Casts a query string arg into an actual boolean value.
 * @param  {String} arg The query string arg.
 * @return {Boolean}
 */
function boolArg(queryParam) {
    if (!queryParam) return false;
    return ["1", "on", "true", "yes", "y"].indexOf(queryParam.toLowerCase()) !== -1;
}

function getResponse(url, callback) {
    var parsedUrl = urlmod.parse(url);
    var host = parsedUrl.hostname;
    var port = parseInt(parsedUrl.port || '80', 10);
    var path = parsedUrl.pathname;
    if (parsedUrl.search) {
        path += '?' + parsedUrl.search;
    }

    var options = {
        hostname: host,
        port: port,
        path: path
    };

    http.get(options, callback);
}

function resolveHttpRedirects(url, callback, maxnum) {
    maxnum = maxnum || 3;
    var count = 0;

    function next(url) {
        getResponse(url, function(res) {
            console.log('status code = ' + res.statusCode);
            if (res.statusCode == 301 || res.statusCode == 302) {
                if (count >= maxnum) {
                    callback(res.headers.location);
                } else {
                    count += 1;
                    next(res.headers.location);
                }
            } else {
                callback(url);
            }
        });
    }

    next(url);
}

app.use(function(req, res, next) {
    res.header("Content-Type", "application/json");
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, Requested-With, Content-Type, Accept");
    next();
});

app.get("/api", function(req, res) {
    res.json({
        name: pkgInfo.name,
        documentation: "https://github.com/n1k0/readable-proxy/blob/master/README.md",
        description: pkgInfo.description,
        version: pkgInfo.version
    });
});

app.get("/api/get", function(req, res) {
    var url = req.query.url,
        sanitize = boolArg(req.query.sanitize),
        userAgent = req.query.userAgent;
    if (!url) {
        return res.status(400).json({
            error: "Missing url parameter"
        });
    }

    var callback = function(url) {
        scrape(url, {
            userAgent: userAgent
        }).then(function(result) {
            res.json(sanitize ? sanitizeResult(result) : result);
        }).catch(function(err) {
            console.log(err);
            res.status(500).json({
                error: {
                    message: err.message
                }
            });
        });
    }

    resolveHttpRedirects(url, callback, 2);
});

exports.serve = function() {
    var server = app.listen(process.env.PORT || 3000, function() {
        var host = server.address().address;
        var port = server.address().port;
        console.log("Server listening at http://%s:%s", host, port);
    });
};
