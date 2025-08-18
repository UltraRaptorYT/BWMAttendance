import sharp from "sharp";

export const getWaterMarkImageByTxt = async (
  width: number,
  height: number,
  txt: string
) => {
  const svg = `
    <svg width="${width}" height="${height}">
      <text x="50%" y="50%" text-anchor="middle" font-weight="bold" font-family="Helvetica, Arial, sans-serif" font-size="36" id="svg_1" stroke-width="0" stroke="#000" fill="#2bbc4f">${txt}</text>
    </svg>
  `;
  return sharp(Buffer.from(svg)).toFormat("png");
};

export const getWaterMarkImageByText = async (
  picUrl: string,
  markTxt: string = "aigf.art",
  width: number = 400,
  height: number = 200
) => {
  try {
    const fimg = await fetch(picUrl);
    const imageBuffer = await (await fimg.blob()).arrayBuffer();
    const orgImg = sharp(imageBuffer);

    const metadata = await orgImg.metadata();

    width = Math.min(metadata.width!, width);
    height = Math.min(metadata.height!, height);

    const watermask = await (
      await getWaterMarkImageByTxt(width, height, markTxt)
    ).toBuffer();

    let top = metadata.height! - height;
    top = top <= 0 ? 20 : top;

    let left = (metadata.width! - width) / 2;
    left = left <= 0 ? 20 : left;

    const output = await orgImg
      .composite([{ input: watermask, left: left, top: top }])
      .png()
      .toBuffer();

    const base64 = "data:image/png;base64," + output.toString("base64");

    return base64;
  } catch (error) {
    console.error("Error in watermark generation:", error);
    throw new Error("Error generating watermark image");
  }
};

export async function POST(req: Request) {
  try {
    const data = await req.json();
    console.log(data);
    const base64_string = await getWaterMarkImageByText(data.picUrl, "p");
    const buffer = Buffer.from(base64_string, "base64");
    return new Response(base64_string, {
      status: 200,
      headers: {},
    });
  } catch (error) {
    console.error("Error in POST request:", error);
    return new Response("Error processing the request", { status: 500 });
  }
}
