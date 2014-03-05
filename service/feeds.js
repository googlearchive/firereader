//todo-hack see #https://github.com/firebase/firereader/issues/30
//todo-hack when that issue is fixed, this script will no longer be necessary
var crypto    = require("crypto")
   , request  = require("request")
   , Parser   = require("feedparser")
   , Firebase = require("firebase")
   , Q        = require('q');

var REFRESH_INTERVAL = 1000*60*10 /* 10 minutes */;

// set this to the user/ path in your firebase namespace, https://<NAME>.firebaseio.com/user
var url = process.env.FBURL;

// any providers accepted by the client should appear here
var services = process.env.SERVICES? process.env.SERVICES.split(',') : ['persona', 'facebook', 'twitter', 'github'];

console.log('connecting to', url);

new Firebase(url).auth(process.env.SECRET, function(err) {
   if (err) {
      console.error("Firebase authentication failed!", err);
   } else {
      setupServices(services);
   }
});

function setupServices(serviceList) {
   for(var i= 0, len = serviceList.length; i < len; i++) {
      launchService(serviceList[i]);
   }
}

function launchService(service) {
   console.log('starting', service);
   var feeds = {};
   var feedContent = {};
   var running = false;
   var ref = new Firebase(url+service);
   setupHandlers();
   setInterval(parseFeeds, REFRESH_INTERVAL);

   function getHash(value) {
      var shasum = crypto.createHash("sha1");
      shasum.update(value);
      return shasum.digest("hex");
   }

   function sanitizeObject(obj) {
      if (typeof obj != typeof {}) {
         return obj;
      }

      var newObj = {};
      var special = [".", "$", "/", "[", "]"];
      for (var key in obj) {
         var sum = -1;
         for (var i in special) {
            sum += (key.indexOf(special[i])) + 1;
         }
         if (sum < 0) {
            if (key == "date" || key == "pubdate" || key == "pubDate") {
               if (obj[key]) {
                  newObj[key] = obj[key].toString();
               }
            } else if (key == "#") {
               newObj["value"] = sanitizeObject(obj[key]);
            } else if (key.indexOf("#") >= 0) {
               newObj["@" + key.replace("#", "")] = sanitizeObject(obj[key]);
            } else if (sanitizeObject(obj[key]) && key != "") {
               newObj[key] = sanitizeObject(obj[key]);
            }
         }
      }
      return newObj;
   }

   function writeStatus(url, data) {
      writeToFirebase(url, data, process.env.SECRET, function(err) {
         if (err) {
            console.error(err);
         }
      });
   }

   function writeToFirebase(url, data, secret, cb) {
//      console.log('writeToFirebase', url);
      var options = {url: url + ".json", method: "PUT", json: data};
      if (secret) {
         options.qs = {auth: secret};
      }

      request(options, function(err, resp, body) {
         var code;
         if (!resp || !resp.statusCode) {
            code = "500";
         } else {
            code = resp.statusCode;
         }

         if (!err && code == 200) {
            if (cb) {
               cb(null);
            }
         } else {
            var msg;
            if (code == 403) {
               msg = "Error: permission denied while writing to " + url + " (did you specify a secret?)";
            } else if (code == 417) {
               msg = "Error: the specified Firebase " + url + " does not exist.";
            } else {
               msg = "Error: could not write to " + url + ", received status code " + code;
            }
            if (err) {
               msg = url + ": " + err.toString();
            }
            if (cb) {
               cb(msg);
            } else {
               console.error(msg);
            }
         }
      });
   }

   function setupHandlers() {
      var self = this;
      ref.on("child_added", function(snap) {
         var userid = snap.name();
//         console.log('setup user', userid);
         if (!feeds[userid]) {
            feeds[userid] = {};
         }
         var childRef = ref.child(userid).child("feeds");
         childRef.on("child_added", editUserFeed.bind(self, userid));
         childRef.on("child_changed", editUserFeed.bind(self, userid));
         childRef.on("child_removed", function(childSnap) {
            delete feeds[userid][childSnap.name()];
         });
      });
      ref.on("child_removed", function(remSnap) {
         var childRef = ref.child(remSnap.name()).child("feeds");
         childRef.off();
      });
   }

   function editUserFeed(userid, snap) {
      var id = snap.name();
//      console.log('edit feed', userid, snap.name());
      var entry = feeds[userid][id] = {
         ref: snap.ref(),
         statusURL: ref.child(userid).child("status/" + id).toString(),
         value: snap.val()
      };
      parseFeed(entry);
   }

   function parseFeeds() {
      if( running ) {
         console.log('skipped parseFeeds for provider %s (still running)', service);
         return;
      }
      var startTime = new Date();
      running = true;
      var promises = [];
      for (var uid in feeds) {
         var user = feeds[uid];
         for (var index in user) {
            promises.push(parseFeed(user[index]));
         }
      }

      console.log("Parsing %d feeds for provider  %s at %s", promises.length, service, startTime);
      Q.allSettled(promises).finally(function() {
         running = false;
         console.log('Finished parsing (%s)', timeElapsed(startTime));
      });
   }

   function parseFeed(feed) {
//      console.log('parseFeed', feed.value && feed.value.url);
      var url = feed.value.url;
      var statusURL = new Firebase(feed.statusURL).toString();
      return Q(true)
         .then(function() {
            var err;
            if (!url || url.indexOf("http") < 0) {
               err = "Error: Invalid feed URL specified: " + url;
            }
            else if (!feed.value.firebase || feed.value.firebase.indexOf("https") < 0) {
               err = "Error: Invalid Firebase URL specified, did you include the https prefix?";
            }
            if( err ) {
               throw err;
            }
         })
         .then(function() {
            return getAndSet(url, getHash(url), statusURL, feed.value.firebase, process.env.SECRET);
         })
         .done(function() {
//            console.log('Parsed feed', url, statusURL);
         }, function(err, statusCode) {
            console.error('PARSE ERROR', err, url, statusURL);
            writeStatus(statusURL, (err||statusCode+'').toString());
         });
   }

   function getAndSet(url, hash, statusURL, fbURL, secret) {
//      console.log('getAndSet', url);
      if (!feedContent[hash] || Date.now() - feedContent[hash].lastSync > REFRESH_INTERVAL) {
         return doRequest(url)
            .then(function(body) {
               feedContent[hash] = {lastSync: Date.now(), content: body};
               return setFeed(body, statusURL, fbURL, secret)
            });
      } else {
         return setFeed(feedContent[hash].content, statusURL, fbURL, secret);
      }
   }

   function setFeed(feed, statusURL, fbURL, secret) {
      var def = Q.defer();
      Parser.parseString(feed, {addmeta: false}, function(err, meta, articles) {
         if (err) {
            writeStatus(statusURL, err.toString());
            def.reject(err);
            return;
         }
         try {
            writeToFirebase(fbURL + "/meta", sanitizeObject(meta), secret, function(err) {
               if (err) {
                  def.reject(err);
                  writeStatus(statusURL, err.toString());
                  return;
               }
               setArticles(articles, 0, articles.length, statusURL, fbURL, secret);
               def.resolve();
            });
         } catch(e) {
            def.reject(e);
            writeStatus(statusURL, e.toString());
         }
      });
      return def.promise;
   }

   function doRequest(opts) {
      var def = Q.defer();
      request(opts, function(err, resp, body) {
         if (!err && resp.statusCode == 200) {
            def.resolve(body);
         } else {
            def.reject(err || resp && resp.statusCode);
         }
      });
      return def.promise;
   }

   function setArticles(articles, done, total, statusURL, fbURL, secret) {
      if (total <= 0) {
         writeStatus(statusURL, "Last Sync: " + new Date().toString() + ' (no articles)');
         return;
      }

      var article = articles[done];
      var id = getHash(article.guid || article.link ||
         article.title || article.summary);
      var date = article.pubDate || article.pubdate || article.date ||
         article["rss:pubdate"] || new Date().toString();
      var timestamp = Date.parse(date);

      var arURL = fbURL + "/articles/" + id;
      var articleObj = sanitizeObject(article);
      articleObj[".priority"] = timestamp;

      writeToFirebase(arURL, articleObj, secret, function(err) {
         if (err) {
            writeStatus(statusURL, err);
         } else {
            done++;
            if (done == total) {
               writeStatus(statusURL, "Last Sync: " + new Date().toString());
            } else {
               setArticles(articles, done, total, statusURL, fbURL, secret);
            }
         }
      });
   }

}

function timeElapsed(startTime) {
   var diff = Math.floor( (Date.now() - startTime.valueOf()) / 1000);
   var units = '';
   if( diff > 60 ) {
      units = 'minute';
      diff = Math.round( (diff/60)*10 )/10;
   }
   else {
      units = 'second';
   }
   return diff + '' + (diff !== 1? units+'s' : units);
}