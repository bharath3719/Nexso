import React, { useEffect, useState } from "react";
import { Stack, Text, DefaultButton, Link, Icon } from "@fluentui/react";
import { T } from "../../styles/typography.js";
import { api } from "../../services/api.js";
import "../../styles/Vendor.css";

export default function VendorDocuments({ vendorId }) {
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    if (!vendorId) return;
    let cancelled = false;
    api.vendors.documents(vendorId)
      .then((data) => { if (!cancelled) setDocs(data.documents || []); })
      .catch(() => { if (!cancelled) setDocs([]); });
    return () => { cancelled = true; };
  }, [vendorId]);

  if (!vendorId) return null;

  return (
    <div className="vdocs-wrapper">
      <Stack tokens={{ childrenGap: 8 }}>
        {/* T.sectionHeader is the correct token for Fluent <Text> (CSS_T is for plain HTML) */}
        <Text styles={T.sectionHeader}>Documents</Text>
        {docs.length === 0 ? (
          <Text styles={T.caption}>No documents uploaded</Text>
        ) : (
          docs.map((d) => (
            <Stack
              key={d.id}
              horizontal
              verticalAlign="center"
              styles={{ root: { justifyContent: "space-between" } }}
            >
              <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                <Icon iconName="FileImage" styles={{ root: { color: "#2563eb" } }} />
                <Link href={d.url} target="_blank">
                  {d.filename || d.doc_type || "Document"}
                </Link>
              </Stack>
              <DefaultButton href={d.url} text="Download" />
            </Stack>
          ))
        )}
      </Stack>
    </div>
  );
}
