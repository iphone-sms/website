document.getElementById('uploadBtn').addEventListener('change', function() {
  let reader = new FileReader();
  reader.onload = (ev) => {
    initSqlJs().then(function(SQL) {
      var bytes = new Uint8Array(ev.target.result);
      var db = new SQL.Database(bytes);
      var stmt = db.prepare(`SELECT chat.ROWID, handle.id
        FROM chat
          LEFT OUTER JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
          LEFT OUTER JOIN handle ON handle.ROWID = chat_handle_join.handle_id
        ORDER BY chat.ROWID`);
      var chats = [];
      while (stmt.step()) {
        var row = stmt.getAsObject();
        if (chats.indexOf(row["ROWID"]) > -1) {
          if (chats[row["ROWID"]]["numbers"].indexOf(row["id"]) === -1) {
            chats[row["ROWID"]]["numbers"].push(row["id"]);
          }
        } else {
          chats[row["ROWID"]] = {
            id: row["ROWID"],
            numbers: new Array(row["id"]),
          }
        }
      }
      var stmt = db.prepare(`
        SELECT
          message.text,
          coalesce(handle.id, 'group') as number, 
          datetime (message.date / 1000000000 + strftime ("%s", "2001-01-01"), "unixepoch", "localtime") AS message_date,
          message.is_from_me
        FROM message
          LEFT OUTER JOIN handle ON handle.ROWID = message.handle_id
          INNER JOIN chat_message_join ON message.ROWID = chat_message_join.message_id AND chat_message_join.chat_id = $id
        WHERE
          TRIM(message.text) IS NOT NULL AND
          message.text NOT LIKE X'efbfbc'
        ORDER BY
          message.ROWID,
          message.date`);
      for (key in chats) {
        stmt.bind({$id: key});
        var messages = []
        while (stmt.step()) {
          var row = stmt.getAsObject();
          messages.push({
            text: row["text"],
            number: row["number"],
            date: row["message_date"],
            from_me: row["is_from_me"] != 1 ? 0 : 1,
          });
        }
        chats[key]["messages"] = messages;
      }
      download("iphone-sms.html", render(chats));
    }).catch((e) => alert(`[ERROR] ${e}`));
  };
  reader.readAsArrayBuffer(this.files[0]);
});

function download(filename, text) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/html;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

function render(c) {
  var header = `<!DOCTYPE html>
    <html>
    <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <link href="https://fonts.googleapis.com/css?family=Roboto" rel="stylesheet">
    <style type="text/css">
    a {
      color: #000000;
      text-decoration: none;
    }
    body {
      font-family: 'Roboto', sans-serif;
    }
    .chat_container {
      width: 800px;
      position: relative;
      font-size: 13px;
      clear: both;
      display: inline-block;
    }
    .message_container {
      width: 100%;
      display: inline-block;
      padding-bottom: 2px;
    }
    .message_date {
      color: #DBDDDE;
      margin: 0px;
      text-align: center;
      font-size: 10px;
      font-style: italic;
    }
    .datetome {
      left: 0px;
      text-align: left;
      float: left;
    }
    .datefromme {
      right: 0px;
      text-align: right;
      float: right;
    }
    .message {
      margin: 2px;
      padding: 8px;
      clear: both;
      border-radius: 10px;
      max-width: 70%;
    }
    .messagetome {
      background-color: #DBDDDE;
      color: #000000;
      left: 0px;
      text-align: left;
      float: left;
    }
    .messagefromme {
      background-color: #1D62F0;
      color: #FFFFFF;
      right: 0px;
      text-align: right;
      float: right;
    }

    </style>
    </head>
    <body>`;

  var footer = `</body></html>`;
  if (c.length <= 0) return header + footer
  
  var list_chats = `${c.map(v => `<li><a href="#${v.id}" name="${v.id}_index">Chat with ${v.numbers}</a></li>`).join("")}`;
  list_chats = `<h3><a name="index">Chats list</a></h3><ul>${list_chats}</ul><hr/>`;

  var chats = `${c.map(v =>
    `<p class="chattitle"><a name="${v.id}">Chat with ${v.numbers}</a> <a href="#${v}_index">👈</a><a href="#index">☝️</a></p>
    <div class="chat_container">
    ${v.messages
      ? `${v.messages.map(m =>
      `<div class="message_container">
        <p class="message_date ${m.from_me === 1 ? `datefromme` : `datetome`}">${m.from_me === 1 ? `From me to ${m.number}` : `From ${m.number} to me`} @ ${m.date}</p>
        <p class="message ${m.from_me === 1 ? `messagefromme` : `messagetome`}">${m.text}</p>
      </div>`).join("")}`
      : ``}
    </div>`
    ).join("")}`;
  return header + list_chats + chats + footer
}
