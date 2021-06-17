const express = require("express");
const socketio = require("socket.io");
const http = require("http");
const path = require("path");
var fs = require("fs");
var ejs = require("ejs");
const app = express();
var axios = require("axios");
var request = require("request");
var cheerio = require("cheerio");
const { html } = require("cheerio/lib/api/manipulation");
var port = process.env.PORT || 5000;
var ejspath = path.join(__dirname, "views");
app.engine("html", ejs.renderFile);
app.set("view engine", "ejs");
app.set("views", ejspath);
app.use(express.static("views"));
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/getpost/:id", async(req, resp) => {
  var uri = "http://medium.com/post/" + req.params.id;
  //console.log(uri);
  function dorequest(uri) {
    return new Promise((resolve, reject) => {
      request(uri, async (err, res, html) => {
        if (!err && res.statusCode === 200) {
          var $ = cheerio.load(html);
          var article = $("p").text();
          resolve(article);
        }
      });
    });
  }
  var articles = await dorequest(uri);



  //comments

  var responseurl =
        "https://medium.com/_/api/posts/" + req.params.id + "/responsesStream?filter=other";
      var p = await axios.get(responseurl);

      var response = JSON.parse(p.data.slice(16));

      var flag = Object.keys(response.payload.references);
      var finalcomments = [];
      var resnamearray = [];
      var commentarray = [];
      if (flag.length > 0) {
        var user = response.payload.references.User;
        var xyz = Object.keys(user);
        for (var a = 0; a < xyz.length; a++) {
          resnamearray.push({
            name: response.payload.references.User[xyz[a]].name,
            id: xyz[a],
          });
        }
        var commentpost = response.payload.references.Post;
        var commentvalues = Object.values(commentpost);
        for (var c = 0; c < commentvalues.length; c++) {
          commentarray.push({
            id: commentvalues[c].creatorId,
            text: commentvalues[c].previewContent.bodyModel.paragraphs[0].text,
          });
        }
        for (var d = 0; d < resnamearray.length; d++) {
          for (var e = 0; e < commentarray.length; e++) {
            if (
              resnamearray[d].id == commentarray[e].id 
              
            ) {
              finalcomments.push({
                name: resnamearray[d].name,
                comment: commentarray[e].text,
              });
            }
          }
        }
      } else {
        finalcomments = [
          {
            name: "no response",
            comment: "no response till now for this post",
          },
        ];
      }
      console.log("reached before return");
  return resp.render("comments",{
      articles:articles,
      finalcomments:finalcomments
  });
});
//creating the server;
var server = http.createServer(app);
//socket
const io = socketio(server);

//listening to socket

io.on("connection", async (socket) => {
  console.log("New User connected");
  socket.on("sendtopic", async (tags) => {
    var tag = tags.toLowerCase();
    var url = "https://medium.com/_/api/tags/" + tag + "/stream?";
    var a = await axios.get(url);
    const b = JSON.parse(a.data.slice(16));

    var k = b.payload.relatedTags;

    var related = [];
    for (var i = 0; i < k.length; i++) {
      related.push(k[i].name);
    }
    var relatedlength = k.length;

    socket.emit("sendrelatedpost", {
      related: related,
      relatedlength: relatedlength,
      postlength: b.payload.streamItems.length,
    });

    var streamitem = b.payload.streamItems;

    var username;
    var titlename;
    var readingtime;

    for (var i = 0; i < streamitem.length; i++) {
      var startime = new Date().getTime();

      socket.emit("startedfetching", { idno: i, msg: "Crawling...." });
      var l = streamitem[i].postPreview.postId;

      var uri = "http://medium.com/post/" + l;

      var creatorId = b.payload.references.Post[l].creatorId;

      username = b.payload.references.User[creatorId].name;
      titlename = b.payload.references.Post[l].title;
      readingtime = Math.round(
        b.payload.references.Post[l].virtuals.readingTime
      );

      var imgid = b.payload.references.Post[l].virtuals.previewImage.imageId;
      var imageurl = "https://miro.medium.com/max/600/" + imgid;

      function dorequest(uri) {
        return new Promise((resolve, reject) => {
          request(uri, async (err, res, html) => {
            if (!err && res.statusCode === 200) {
              var $ = cheerio.load(html);
              var article = $("p").text();
              resolve(article);
            }
          });
        });
      }
      var articles = await dorequest(uri);

      /*var responseurl =
        "https://medium.com/_/api/posts/" + l + "/responsesStream?filter=other";
      var p = await axios.get(responseurl);

      var response = JSON.parse(p.data.slice(16));

      var flag = Object.keys(response.payload.references);
      var finalcomments = [];
      var resnamearray = [];
      var commentarray = [];
      if (flag.length > 0) {
        var user = response.payload.references.User;
        var xyz = Object.keys(user);
        for (var a = 0; a < xyz.length; a++) {
          resnamearray.push({
            name: response.payload.references.User[xyz[a]].name,
            id: xyz[a],
          });
        }
        var commentpost = response.payload.references.Post;
        var commentvalues = Object.values(commentpost);
        for (var c = 0; c < commentvalues.length; c++) {
          commentarray.push({
            id: commentvalues[c].creatorId,
            text: commentvalues[c].previewContent.bodyModel.paragraphs[0].text,
          });
        }
        for (var d = 0; d < resnamearray.length; d++) {
          for (var e = 0; e < commentarray.length; e++) {
            if (
              resnamearray[d].id == commentarray[e].id &&
              resnamearray[d].name != username
            ) {
              finalcomments.push({
                name: resnamearray[d].name,
                comment: commentarray[e].text,
              });
            }
          }
        }
      } else {
        finalcomments = [
          {
            name: "no response",
            comment: "no response till now for this post",
          },
        ];
      }*/
      var crawltime = new Date().getTime() - startime;
      var postrelatedtags = [];
      for (
        var p = 0;
        p < b.payload.references.Post[l].virtuals.tags.length;
        p++
      ) {
        postrelatedtags.push(
          b.payload.references.Post[l].virtuals.tags[p].name
        );
      }
      obj = {
        imageurl: imageurl,
        username: username,
        id: i,
        titlename: titlename,
        crawltime: crawltime,
        readingtime: readingtime,
        articles: articles,
        postrelatedtags: postrelatedtags,
        postid: l,
      };
      socket.emit("senddata", { obj: obj });
    }

    //about articles
  });
});
server.listen(port, () => {
  console.log("Server is listening");
});
