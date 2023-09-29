import { Web5 } from "@web5/api";
import { useState, useEffect } from "react";

export default function Home() {

  const [web5, setWeb5] = useState(null);
  const [myDid, setMyDid] = useState(null);
  const [receivedDings, setReceivedDings] = useState([]);
  const [sentDings, setSentDings] = useState([]);
  const [noteValue, setNoteValue] = useState('');
  const [recipientDid, setRecipientDid] = useState('');


  const allDings = [...receivedDings, ...sentDings];
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

  const configureProtocol = async (web5) => {
    // define the protocol
    const dingerProtocolDefinition = {
      protocol: "https://blackgirlbytes.dev/dinger-protocol",
      published: true,
      types: {
        ding: {
          schema: "ding",
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
    // query for the protocol
    const { protocols, status: protocolStatus } = await web5.dwn.protocols.query({
      message: {
        filter: {
          protocol: "https://blackgirlbytes.dev/dinger-protocol",
        },
      },
    });
    // handle query results
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
    const currentDate = new Date().toLocaleDateString();


    const ding = {
      sender: myDid,
      note: noteValue,
      recipient: recipientDid,
      timestampWritten: `${currentDate}}`,
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
    console.log(status)
    await fetchDings(web5, myDid);
  }

  // send a ding to another dwn
  // const sendDing = async (ding) => {


  const handleCopyDid = async () => {
    if (myDid) {
      try {
        await navigator.clipboard.writeText(myDid);
        console.log('DID copied to clipboard', myDid)
      } catch (err) {
        console.log('Failed to copy DID: ' + err);
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
        dateSort: 'createdAscending',
      },
    });
    console.log('records!!!!', records)

    try {

      const results = await Promise.all(
        records.map(async (record) => await record.data.json())
      );

      console.log('results!!!!', results)
      // if (results.length > 0) {
      if (recordStatus.code == 200) {
        const received = results.filter(
          (result) => result.recipient === did
        );

        const sent = results.filter(
          (result) => result.sender === did
        );

        setReceivedDings(received);
        setSentDings(sent)
      }
    } catch (error) {
      console.error(error);
    }

  };


  return (
    <div>
      <h1>Dinger</h1>
      <p>This is a demo application to show how DWNs can communicate with other DWNs</p>
      <button onClick={handleCopyDid}>Copy DID</button>
      <form onSubmit={handleSubmit}>
        <label htmlFor="recipientDid">Recipient DID</label>
        <input
          type="text"
          placeholder="Enter DID"
          name="recipientDid" id="recipientDid"
          value={recipientDid}
          onChange={(e) => setRecipientDid(e.target.value)}
        />
        <label htmlFor="note">Note</label>
        <input
          type="text"
          placeholder="Enter Note"
          value={noteValue}
          name="note" id="note"
          onChange={(e) => setNoteValue(e.target.value)}
        />
        <button type="submit">Submit</button>
      </form>
      <h2>All Dings</h2>
      {Object.entries(groupedDings).map(([recipient, dings]) => (
        <div key={recipient}>
          <h3>Conversation with {recipient}</h3>
          <ul>
            {dings.map((ding, index) => (
              <li key={index} style={{ textAlign: ding.sender === myDid ? 'right' : 'left' }}>
                <p>{ding.sender === myDid ? 'you' : 'recipient'}: {ding.note}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>

  );
}

