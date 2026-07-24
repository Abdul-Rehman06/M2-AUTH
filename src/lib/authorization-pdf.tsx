import {
  Document, Page, Text, View, StyleSheet, Font, Image,
} from "@react-pdf/renderer";

// Font URLs (bundled as static assets via Vite). Using static TTFs
// (variable for Newsreader/PublicSans) because fontkit inside
// @react-pdf/renderer chokes on some @fontsource WOFF files.
import newsreaderTtf from "@/assets/fonts/Newsreader.ttf?url";
import publicSansTtf from "@/assets/fonts/PublicSans.ttf?url";
import plexMono400 from "@/assets/fonts/IBMPlexMono-Regular.ttf?url";
import plexMono500 from "@/assets/fonts/IBMPlexMono-Medium.ttf?url";
import plexMono600 from "@/assets/fonts/IBMPlexMono-SemiBold.ttf?url";

let fontsRegistered = false;
function registerFontsOnce() {
  if (fontsRegistered) return;
  fontsRegistered = true;
  Font.register({
    family: "Newsreader",
    fonts: [
      { src: newsreaderTtf, fontWeight: 400 },
      { src: newsreaderTtf, fontWeight: 500 },
      { src: newsreaderTtf, fontWeight: 600 },
    ],
  });
  Font.register({
    family: "Public Sans",
    fonts: [
      { src: publicSansTtf, fontWeight: 400 },
      { src: publicSansTtf, fontWeight: 500 },
      { src: publicSansTtf, fontWeight: 700 },
    ],
  });
  Font.register({
    family: "IBM Plex Mono",
    fonts: [
      { src: plexMono400, fontWeight: 400 },
      { src: plexMono500, fontWeight: 500 },
      { src: plexMono600, fontWeight: 600 },
    ],
  });
  // Disable hyphenation for legal document look
  Font.registerHyphenationCallback((word) => [word]);
}


const C = {
  ink: "#10161C",
  ink70: "#4A555F",
  ink45: "#7C868F",
  paper: "#FAF6F1",
  card: "#FFFFFF",
  rule: "#EADFD1",
  ruleStrong: "#D6C7B5",
  brand: "#D45E0F",
  brandGlow: "#F17A24",
  brandSoft: "#FEECDA",
  brandDeep: "#A94407",
  // Legacy names kept so existing style references stay valid.
  seal: "#D45E0F",
  sealTint: "#FEECDA",
} as const;

const s = StyleSheet.create({
  page: {
    paddingTop: 43,
    paddingBottom: 60,
    paddingHorizontal: 43,
    fontFamily: "Public Sans",
    fontSize: 10,
    color: C.ink,
    backgroundColor: C.paper,
  },
  topRule: {
    borderTopColor: C.brand,
    borderTopWidth: 2.5,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  eyebrow: {
    fontFamily: "IBM Plex Mono",
    fontSize: 7.5,
    letterSpacing: 1.1,
    color: C.ink70,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: "Newsreader",
    fontWeight: 500,
    fontSize: 22,
    marginTop: 4,
    color: C.ink,
  },
  titleAccent: {
    fontFamily: "Newsreader",
    fontWeight: 500,
    color: C.brand,
  },
  metaBlock: { alignItems: "flex-end" },
  metaLine: {
    fontFamily: "IBM Plex Mono",
    fontSize: 8,
    color: C.ink,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  metaKey: { color: C.ink45 },
  headerRule: {
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    marginTop: 8,
    marginBottom: 16,
  },
  summaryPanel: {
    backgroundColor: C.brandSoft,
    borderColor: C.brand,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 18,
  },
  summaryLabel: {
    fontFamily: "IBM Plex Mono",
    fontSize: 7.5,
    letterSpacing: 1.1,
    color: C.brandDeep,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  summaryText: {
    fontFamily: "Newsreader",
    fontSize: 12.5,
    lineHeight: 1.45,
    color: C.ink,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomColor: C.ruleStrong,
    borderBottomWidth: 0.75,
    paddingBottom: 6,
    marginBottom: 10,
  },
  sectionBadge: {
    backgroundColor: C.brand,
    color: "#FFFFFF",
    fontFamily: "IBM Plex Mono",
    fontWeight: 600,
    fontSize: 8.5,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginRight: 8,
    letterSpacing: 0.6,
  },
  sectionTitle: {
    fontFamily: "Public Sans",
    fontWeight: 700,
    fontSize: 9.5,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: C.ink,
  },
  row: {
    flexDirection: "row",
    borderBottomColor: C.rule,
    borderBottomWidth: 0.5,
    paddingVertical: 6,
  },
  rowKey: {
    width: 140,
    fontFamily: "IBM Plex Mono",
    fontSize: 7.5,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: C.ink70,
    paddingTop: 1,
  },
  rowVal: {
    flex: 1,
    fontFamily: "Public Sans",
    fontSize: 10,
    color: C.ink,
  },
  rowValMono: {
    flex: 1,
    fontFamily: "IBM Plex Mono",
    fontSize: 9.5,
    color: C.ink,
  },
  authPara: {
    fontFamily: "Newsreader",
    fontSize: 11.5,
    lineHeight: 1.6,
    color: C.ink,
    marginBottom: 8,
  },
  fillMono: {
    fontFamily: "IBM Plex Mono",
    fontWeight: 600,
    color: C.seal,
  },
  fillName: {
    fontFamily: "Newsreader",
    fontWeight: 600,
    color: C.seal,
  },
  divider: {
    borderBottomColor: C.rule,
    borderBottomWidth: 0.5,
    marginVertical: 10,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 5,
  },
  bulletMark: {
    width: 14,
    fontFamily: "IBM Plex Mono",
    color: C.seal,
    fontSize: 10,
  },
  bulletText: {
    flex: 1,
    fontFamily: "Newsreader",
    fontSize: 10,
    lineHeight: 1.5,
    color: C.ink,
  },
  consentLine: {
    fontFamily: "Public Sans",
    fontSize: 9,
    color: C.ink70,
    marginTop: 12,
  },
  consentAccent: { color: C.seal, fontFamily: "IBM Plex Mono", fontSize: 8.5 },
  sigBlock: {
    marginTop: 14,
    borderColor: C.ruleStrong,
    borderWidth: 1,
    padding: 12,
  },
  sigLabel: {
    fontFamily: "IBM Plex Mono",
    fontSize: 7.5,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: C.ink70,
    marginBottom: 6,
  },
  sigCanvasWrap: {
    position: "relative",
    height: 90,
    justifyContent: "flex-end",
  },
  sigImg: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    objectFit: "contain",
  },
  sigBaselineRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 2,
  },
  sigX: {
    fontFamily: "Newsreader",
    fontWeight: 500,
    fontSize: 12,
    color: C.ink,
    marginRight: 4,
    marginBottom: -1,
  },
  sigBaseline: {
    flex: 1,
    borderBottomColor: C.ink,
    borderBottomWidth: 0.75,
    height: 1,
  },
  sigMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  sigMetaKey: {
    fontFamily: "IBM Plex Mono",
    fontSize: 7.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: C.ink45,
  },
  sigMetaVal: {
    fontFamily: "Public Sans",
    fontSize: 10,
    color: C.ink,
    marginTop: 1,
  },
  auditFooter: {
    marginTop: 16,
    paddingTop: 8,
    borderTopColor: C.rule,
    borderTopWidth: 0.5,
  },
  auditLine: {
    fontFamily: "IBM Plex Mono",
    fontSize: 7,
    color: C.ink45,
    lineHeight: 1.5,
    letterSpacing: 0.4,
  },
  pageFooter: {
    position: "absolute",
    left: 43,
    right: 43,
    bottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "IBM Plex Mono",
    fontSize: 7.5,
    color: C.ink45,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    borderTopColor: C.rule,
    borderTopWidth: 0.5,
    paddingTop: 6,
  },
});

export type PDFAuthData = {
  ref: string;
  signedAt: Date; // ISO/Date
  signatureDataUrl: string;
  brand: string;
  last4: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  apt?: string;
  city: string;
  state: string;
  zip: string;
  amountFormatted: string;   // e.g. "297.00"
  firstCharge: string;
  startDateText: string;     // e.g. "July 24, 2026"
  planName?: string;
  cardName: string;
  expiry: string;
  typedName: string;
  consentAcceptedAt: Date;
  ip: string;
  userAgent: string;
  agreementVersion: string;  // "2026.1"
};

function toISO(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function Header({ data }: { data: PDFAuthData }) {
  return (
    <View fixed>
      <View style={s.topRule} />
      <View style={s.headerRow}>
        <View>
          <Text style={s.eyebrow}>Form M2-AUTH · Rev. {data.agreementVersion}</Text>
          <Text style={s.title}>Recurring Payment Authorization</Text>
        </View>
        <View style={s.metaBlock}>
          <Text style={s.metaLine}><Text style={s.metaKey}>ID: </Text>{data.ref}</Text>
          <Text style={s.metaLine}><Text style={s.metaKey}>SIGNED: </Text>{toISO(data.signedAt).slice(0, 10)}</Text>
          <Text style={s.metaLine}><Text style={s.metaKey}>STATUS: </Text>ACTIVE</Text>
        </View>
      </View>
      <View style={s.headerRule} />
    </View>
  );
}

function PageFooter({ pageLabel }: { pageLabel: string }) {
  return (
    <View style={s.pageFooter} fixed>
      <Text>Form M2-AUTH Rev. 2026.1</Text>
      <Text>M2 Phenom · Confidential</Text>
      <Text>{pageLabel}</Text>
    </View>
  );
}

function DataRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.rowKey}>{k}</Text>
      <Text style={mono ? s.rowValMono : s.rowVal}>{v || "—"}</Text>
    </View>
  );
}

export function AuthorizationPDF({ data }: { data: PDFAuthData }) {
  registerFontsOnce();

  const fullName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(" ");
  const amountDisplay = `$${data.amountFormatted}`;
  const billingAddress = [
    data.street,
    data.apt,
    `${data.city}, ${data.state} ${data.zip}`,
  ].filter(Boolean).join(", ");

  const summary =
    `${amountDisplay} will be charged to the ${data.brand} ending ${data.last4} every month, ` +
    `starting ${data.startDateText}, until cancelled.`;

  return (
    <Document
      title={`M2-AUTH ${data.ref}`}
      author="M2 Phenom"
      subject="Recurring Payment Authorization"
    >
      {/* PAGE 1 — THE RECORD */}
      <Page size="LETTER" style={s.page}>
        <Header data={data} />

        <View style={s.summaryPanel}>
          <Text style={s.summaryLabel}>Confirmation</Text>
          <Text style={s.summaryText}>{summary}</Text>
        </View>

        <View style={s.sectionHeader}>
          <Text style={s.sectionBadge}>01</Text>
          <Text style={s.sectionTitle}>Record of authorization</Text>
        </View>

        <DataRow k="Account holder" v={fullName} />
        <DataRow k="Email" v={data.email} />
        <DataRow k="Phone" v={data.phone} mono />
        <DataRow k="Billing address" v={billingAddress} />
        <DataRow k="Monthly amount" v={`${amountDisplay} USD`} mono />
        <DataRow k="Billing frequency" v="Monthly, until cancelled" />
        <DataRow k="First charge date" v={data.startDateText} />
        <DataRow k="Plan name" v={data.planName || "—"} />
        <DataRow k="Card brand" v={data.brand} />
        <DataRow k="Card last four" v={`•••• ${data.last4}`} mono />
        <DataRow k="Card expiry" v={data.expiry} mono />
        <DataRow k="Name on card" v={data.cardName} />

        <PageFooter pageLabel="Page 1 of 2" />
      </Page>

      {/* PAGE 2 — AUTHORIZATION & SIGNATURE */}
      <Page size="LETTER" style={s.page}>
        <Header data={data} />

        <View style={s.sectionHeader}>
          <Text style={s.sectionBadge}>02</Text>
          <Text style={s.sectionTitle}>Authorization</Text>
        </View>

        <Text style={s.authPara}>
          I, <Text style={s.fillName}>{fullName}</Text>, authorize M2 Phenom and any affiliated M2 product to charge the card listed above <Text style={s.fillMono}>{amountDisplay}</Text> every month, beginning <Text style={s.fillName}>{data.startDateText}</Text>.
        </Text>
        <Text style={s.authPara}>
          This is a subscription. It repeats indefinitely, with no end date, and continues until I cancel it myself.
        </Text>

        <View style={s.divider} />

        {[
          "I am the authorized holder of this card, or I have permission from the holder to use it.",
          "The charge will appear on my statement as M2 PHENOM.",
          "To cancel, I notify M2 Phenom in writing at least 3 business days before my next billing date. Cancelling stops future charges; it does not refund charges already processed.",
          "If the recurring amount changes, M2 Phenom will notify me at least 10 days before the new amount is charged.",
          "If a charge fails, M2 Phenom may retry it and may suspend my access until payment clears.",
          "I will raise any billing question with M2 Phenom directly before disputing a charge with my card issuer.",
        ].map((t, i) => (
          <View key={i} style={s.bulletRow} wrap={false}>
            <Text style={s.bulletMark}>—</Text>
            <Text style={s.bulletText}>{t}</Text>
          </View>
        ))}

        <Text style={s.consentLine}>
          Consent checkbox accepted at{" "}
          <Text style={s.consentAccent}>{toISO(data.consentAcceptedAt)}</Text>
          {" "}— signer confirmed they read this authorization, agreed to it, and accepted their typed and drawn signature as their legal electronic signature.
        </Text>

        <View style={s.sigBlock} wrap={false}>
          <Text style={s.sigLabel}>Signature</Text>
          <View style={s.sigCanvasWrap}>
            {data.signatureDataUrl ? (
              <Image style={s.sigImg} src={data.signatureDataUrl} />
            ) : null}
          </View>
          <View style={s.sigBaselineRow}>
            <Text style={s.sigX}>✕</Text>
            <View style={s.sigBaseline} />
          </View>
          <View style={s.sigMeta}>
            <View>
              <Text style={s.sigMetaKey}>Typed legal name</Text>
              <Text style={s.sigMetaVal}>{data.typedName}</Text>
            </View>
            <View>
              <Text style={s.sigMetaKey}>Date</Text>
              <Text style={s.sigMetaVal}>{toISO(data.signedAt).slice(0, 10)}</Text>
            </View>
          </View>
        </View>

        <View style={s.auditFooter}>
          <Text style={s.auditLine}>AUTH ID     {data.ref}</Text>
          <Text style={s.auditLine}>TIMESTAMP   {toISO(data.signedAt)}</Text>
          <Text style={s.auditLine}>IP ADDRESS  {data.ip}</Text>
          <Text style={s.auditLine}>USER AGENT  {data.userAgent}</Text>
          <Text style={s.auditLine}>AGREEMENT   Form M2-AUTH · Rev. {data.agreementVersion}</Text>
        </View>

        <PageFooter pageLabel="Page 2 of 2" />
      </Page>
    </Document>
  );
}
