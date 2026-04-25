# METAR & TAF Decoder

A modern, responsive web application to decode METAR and TAF aviation weather reports into human-readable information. Built with Next.js, TypeScript, and Tailwind CSS.

## Features

- **METAR Decoding**: Parse and decode METAR weather reports
- **Visual Data Cards**: Weather information displayed in beautiful cards with icons
- **Station Information**: ICAO code, observation time
- **Wind Data**: Direction, speed, gusts
- **Visibility**: Horizontal visibility in meters
- **Temperature & Dewpoint**: In Celsius with spread calculation
- **Pressure**: QNH in hPa
- **Cloud Layers**: Amount, height, and type (CB/TCU)
- **Raw Data View**: Original METAR code for reference

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Lucide icons

## Live Demo

**[https://stunning-salamander-337dee.netlify.app](https://stunning-salamander-337dee.netlify.app)**

## Usage

1. Enter a METAR code in the input field
2. Click "Decodieren" or press Enter
3. View the decoded weather information

### Example METAR Codes

```
EDDF 251220Z 27008KT 9999 FEW040 12/08 Q1020 NOSIG
```

## Development

```bash
npm install
npm run dev
```

Build for production:
```bash
npm run build
```

## Deployment

Deployed to Netlify. Connect your GitHub repo for automatic deployments.

## License

MIT
