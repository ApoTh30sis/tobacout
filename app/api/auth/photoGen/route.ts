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

        const packYears = (cigs/20)*(pastYears+futureYears); // Calculating the exposure

        const k = Math.log(10)/60; // Growth Factor (calculated based on the fact that intensity maxes out 60)

        let intensity = Math.exp(k*packYears); // intensity function on a scale of 10

        if (intensity  >= 7)
            intensity = 7;

        const prompt = `If 10/10 is the worst smoking facial symptoms can get, and 0/10 is no symptoms at all, transform this photo to show ${intensity}/10 symptoms. 
        The symptoms are: wrinkles, SUNKEN CHEEKS, SAGGING SKIN, SMOKER'S WRINKLES AROUND THE LIPS, skin AND LIPS discoloration, yellow teeth, and cracking, darkened lips.
        MAKE SURE TO show the mouth open to show the yellow teeth. Also age the person ${futureYears} in the future.
        At higher intensities the person should also look naturally older — 
        greyer hair, age spots, looser skin from aging, and overall facial 
        aging consistent with someone who is realistically older. The aging 
        and smoking symptoms should blend seamlessly together so the result 
        looks like a real photograph of this person taken years or decades 
        in the future. Never apply smoking damage without also applying 
        the corresponding natural age progression.`;

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