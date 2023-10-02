import { Web5 } from "@web5/api";
import { useState, useEffect } from "react";

export default function Home() {
  const [web5, setWeb5] = useState(null);
  const [myDid, setMyDid] = useState(null);
  const [receivedDings, setReceivedDings] = useState([]);
  const [sentDings, setSentDings] = useState([]);
  const [noteValue, setNoteValue] = useState("");
  const [recipientDid, setRecipientDid] = useState("");
  const [activeRecipient, setActiveRecipient] = useState(null);

  const allDings = [...receivedDings, ...sentDings];
  const sortedDings = allDings.sort(
    (a, b) => new Date(a.timestampWritten) - new Date(b.timestampWritten),
  );

  const groupedDings = allDings.reduce((acc, ding) => {
    const recipient = ding.sender === myDid ? ding.recipient : ding.sender;
    if (!acc[recipient]) acc[recipient] = [];
    acc[recipient].push(ding);
    return acc;
  }, {});

  useEffect(() => {
    const initWeb5 = async () => {
      const { web5, did } = await Web5.connect();
      setWeb5(web5);
      setMyDid(did);

      if (web5 && did) {
        await configureProtocol(web5);
        await fetchDings(web5, did);
      }
    };
    initWeb5();
  }, []);

  useEffect(() => {
    if (!web5 || !myDid) return;

    const intervalId = setInterval(async () => {
      await fetchDings(web5, myDid);
    }, 2000);

    return () => clearInterval(intervalId);
  }, [web5, myDid]);

  const configureProtocol = async (web5) => {
    const dingerProtocolDefinition = {
      protocol: "https://blackgirlbytes.dev/dinger-protocol",
      published: true,
      types: {
        ding: {
          schema: {
            type: "object",
            properties: {
              sender: { type: "string" },
              note: { type: "string" },
              recipient: { type: "string" },
              timestampWritten: { type: "string" },
            },
          },
          dataFormats: ["application/json"],
        },
      },
      structure: {
        ding: {
          $actions: [
            { who: "anyone", can: "write" },
            { who: "author", of: "ding", can: "read" },
            { who: "recipient", of: "ding", can: "read" },
          ],
        },
      },
    };

    const { protocols, status: protocolStatus } =
      await web5.dwn.protocols.query({
        message: {
          filter: {
            protocol: "https://blackgirlbytes.dev/dinger-protocol",
          },
        },
      });

    if (protocolStatus.code !== 200 || protocols.length === 0) {
      const { protocolStatus } = await web5.dwn.protocols.configure({
        message: {
          definition: dingerProtocolDefinition,
        },
      });
      console.log("Configure protocol status", protocolStatus);
    }
  };

  const constructDing = () => {
    const timestampWritten = new Date().toISOString();
    const ding = {
      sender: myDid,
      note: noteValue,
      recipient: recipientDid,
      timestampWritten,
    };
    return ding;
  };

  const writeToDwn = async (ding) => {
    const { record } = await web5.dwn.records.write({
      data: ding,
      message: {
        protocol: "https://blackgirlbytes.dev/dinger-protocol",
        protocolPath: "ding",
        schema: "ding",
        recipient: recipientDid,
      },
    });
    return record;
  };
  const sendRecord = async (record) => {
    return await record.send(recipientDid);
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    const ding = constructDing();
    const record = await writeToDwn(ding);
    const { status } = await sendRecord(record);
    console.log(status);
    await fetchDings(web5, myDid);
  };

  const handleCopyDid = async () => {
    if (myDid) {
      try {
        await navigator.clipboard.writeText(myDid);
        console.log("DID copied to clipboard", myDid);
      } catch (err) {
        console.log("Failed to copy DID: " + err);
      }
    }
  };

  const fetchDings = async (web5, did) => {
    const { records, status: recordStatus } = await web5.dwn.records.query({
      message: {
        filter: {
          protocol: "https://blackgirlbytes.dev/dinger-protocol",
          protocolPath: "ding",
        },
        dateSort: "createdDescending",
      },
    });

    try {
      const results = await Promise.all(
        records.map(async (record) => await record.data.json()),
      );

      if (recordStatus.code == 200) {
        const received = results.filter((result) => result.recipient === did);
        const sent = results.filter((result) => result.sender === did);

        setReceivedDings(received);
        setSentDings(sent);
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>Dinger</h1>
      </header>

      <main>
        <aside>
          <h2>Chat list</h2>
          {Object.keys(groupedDings).map((recipient) => (
            <div
              key={recipient}
              className="sidebar-item"
              onClick={() => setActiveRecipient(recipient)}
            >
              <h3>{recipient}</h3>
            </div>
          ))}
        </aside>

        <section>
          {activeRecipient && groupedDings[activeRecipient] && (
            <div className="conversation">
              <h3>
                Conversation with{" "}
                <span className="truncate">{activeRecipient}</span>
              </h3>
              <ul>
                {sortedDings
                  .filter(
                    (ding) =>
                      ding.sender === activeRecipient ||
                      ding.recipient === activeRecipient,
                  )
                  .map((ding, index) => (
                    <li
                      key={index}
                      className={
                        ding.sender === myDid ? "bg-blue-100" : "bg-gray-100"
                      }
                    >
                      <p>
                        <strong>
                          {ding.sender === myDid ? "You" : "Recipient"}:
                        </strong>{" "}
                        {ding.note}
                      </p>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </section>
      </main>

      <footer className="sticky-footer">
        <div className="footer-section" onClick={handleCopyDid}>
          <button>Copy DID</button>
        </div>
        <form className="footer-section" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="recipientDid">Recipient DID</label>
            <input
              type="text"
              placeholder="Enter DID"
              name="recipientDid"
              id="recipientDid"
              value={recipientDid}
              onChange={(e) => setRecipientDid(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label htmlFor="note">Note</label>
            <input
              type="text"
              placeholder="Enter Note"
              value={noteValue}
              name="note"
              id="note"
              onChange={(e) => setNoteValue(e.target.value)}
            />
          </div>
        </form>
        <div className="footer-section">
          <button type="submit" onClick={handleSubmit}>
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}
