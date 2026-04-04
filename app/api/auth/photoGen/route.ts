import { NextUrlWithParsedQuery } from 'next/dist/server/request-meta';
import { NextRequest, NextResponse } from 'next/server';
import {GoogleGenerativeAI} from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);


export async function POST(req: NextRequest) {
    try{
        const body = await req.formData();
        
        const cigs = Number(body.get('noOfCigs'));
        const pastYears = Number(body.get('pastYears'));
        const futureYears = Number(body.get('futureYears'));
        const userPhoto = body.get('userPhoto') as File;

        if (!userPhoto){
            return NextResponse.json({ error: "No file uploaded" }, {status: 400});
        
        }

        const bytes = await userPhoto.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64Image = buffer.toString('base64');

        const model = genAI.getGenerativeModel({model: "gemini-3.1-flash-image-preview"});

        let packYears = (cigs/20)*(pastYears+futureYears); // Calculating the exposure

        let k = Math.log(10)/60; // Growth Factor (calculated based on the fact that intensity maxes out 60)

        let intensity = Math.exp(k*packYears); // intensity function on a scale of 10

        const prompt = "Generate a photo of a cat. Make it cartoon and simple.";

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                data: base64Image,
                mimeType: userPhoto.type,
                },
            },
        ]);

        const response = await result.response;

        const generatedImages = response.candidates?.[0].content.parts
            .filter(part => part.inlineData)
            .map(part => part.inlineData?.data);
        
        if (!generatedImages || generatedImages.length === 0)
        {
            return NextResponse.json({error: "No Images were generated"}, {status: 500});
        }
        

        return NextResponse.json({success: true, data: generatedImages}); // Returns a base64 string that represents an image
    }
    catch (error) {
        console.error("Gemini error: ", error);
        return NextResponse.json({error: "Internal Server Error"}, {status: 500});
    }
        
}