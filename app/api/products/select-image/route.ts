import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Request validation schema
const selectImageSchema = z.object({
  images: z.array(z.object({
    url: z.string(),
    alt: z.string().optional(),
    title: z.string().optional(),
    className: z.string().optional(),
    parentClassName: z.string().optional(),
    parentId: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    position: z.object({
      top: z.number(),
      left: z.number(),
      visible: z.boolean(),
    }).optional(),
    index: z.number().optional(),
  })),
  productName: z.string(),
  productDescription: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Add CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    const body = await request.json();
    
    // Validate input
    const validationResult = selectImageSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.issues },
        { status: 400, headers }
      );
    }

    const { images, productName, productDescription } = validationResult.data;

    if (images.length === 0) {
      return NextResponse.json(
        { error: 'No images provided for selection' },
        { status: 400, headers }
      );
    }

    // If only one image, return it directly
    if (images.length === 1) {
      return NextResponse.json({
        success: true,
        selectedImageUrl: images[0].url,
        confidence: 0.8,
        reasoning: 'Only one image available',
      }, { headers });
    }

    // Prepare image metadata for AI analysis
    const imageDescriptions = images.map((img, index) => {
      const description = [
        `Image ${index + 1}:`,
        `URL: ${img.url}`,
        img.alt ? `Alt text: "${img.alt}"` : null,
        img.title ? `Title: "${img.title}"` : null,
        img.className ? `CSS class: "${img.className}"` : null,
        img.parentClassName ? `Parent class: "${img.parentClassName}"` : null,
        img.parentId ? `Parent ID: "${img.parentId}"` : null,
        img.width && img.height ? `Dimensions: ${img.width}x${img.height}` : null,
        img.position?.visible ? 'Visible in viewport' : 'Not visible in viewport',
      ].filter(Boolean).join('\n');
      
      return description;
    }).join('\n\n');

    // Create AI prompt
    const prompt = `You are helping select the best product image from a webpage. 

Product: "${productName}"
${productDescription ? `Description: "${productDescription}"` : ''}

Available images with metadata:
${imageDescriptions}

Please analyze these images based on their metadata and select the one most likely to be the main product image. Consider:
1. Alt text and title relevance to the product
2. CSS classes that suggest product images (e.g., "product", "main", "hero", "primary")
3. Parent element context
4. Image dimensions (larger images are often main product images)
5. Position and visibility on the page

Respond with a JSON object containing:
{
  "selectedImageIndex": <number>, // 0-based index of the best image
  "confidence": <number>, // 0.0 to 1.0 confidence score
  "reasoning": "<string>" // Brief explanation of why this image was selected
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.1,
      });

      const response = completion.choices[0]?.message?.content?.trim();
      if (!response) {
        throw new Error('No response from AI');
      }

      // Parse AI response
      let aiResult;
      try {
        aiResult = JSON.parse(response);
      } catch (parseError) {
        // Fallback: try to extract index from response
        const indexMatch = response.match(/selectedImageIndex["\s:]*(\d+)/i);
        if (indexMatch) {
          aiResult = {
            selectedImageIndex: parseInt(indexMatch[1]),
            confidence: 0.7,
            reasoning: 'Parsed from AI response'
          };
        } else {
          throw new Error('Could not parse AI response');
        }
      }

      const selectedIndex = aiResult.selectedImageIndex;
      if (selectedIndex < 0 || selectedIndex >= images.length) {
        throw new Error('Invalid image index from AI');
      }

      const selectedImage = images[selectedIndex];

      return NextResponse.json({
        success: true,
        selectedImageUrl: selectedImage.url,
        confidence: aiResult.confidence || 0.7,
        reasoning: aiResult.reasoning || 'Selected by AI analysis',
        selectedImageIndex: selectedIndex,
      }, { headers });

    } catch (aiError) {
      console.error('AI image selection error:', aiError);
      
      // Fallback: select based on simple heuristics
      let bestImage = images[0];
      let bestScore = 0;
      let reasoning = 'Fallback heuristic selection';

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        let score = 0;

        // Score based on alt text relevance
        if (img.alt) {
          const altLower = img.alt.toLowerCase();
          const nameLower = productName.toLowerCase();
          if (altLower.includes(nameLower) || nameLower.includes(altLower)) {
            score += 3;
          }
          if (altLower.includes('product') || altLower.includes('main')) {
            score += 2;
          }
        }

        // Score based on CSS classes
        if (img.className) {
          const classLower = img.className.toLowerCase();
          if (classLower.includes('product') || classLower.includes('main') || classLower.includes('hero')) {
            score += 2;
          }
        }

        // Score based on parent classes
        if (img.parentClassName) {
          const parentClassLower = img.parentClassName.toLowerCase();
          if (parentClassLower.includes('product') || parentClassLower.includes('main')) {
            score += 1;
          }
        }

        // Score based on visibility
        if (img.position?.visible) {
          score += 1;
        }

        // Score based on size (larger images often more important)
        if (img.width && img.height) {
          const area = img.width * img.height;
          if (area > 50000) score += 2; // Large image
          else if (area > 10000) score += 1; // Medium image
        }

        if (score > bestScore) {
          bestScore = score;
          bestImage = img;
          reasoning = `Heuristic selection (score: ${score})`;
        }
      }

      return NextResponse.json({
        success: true,
        selectedImageUrl: bestImage.url,
        confidence: Math.min(0.8, 0.4 + (bestScore * 0.1)),
        reasoning: reasoning,
      }, { headers });
    }

  } catch (error) {
    console.error('Image selection error:', error);
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    return NextResponse.json(
      { error: 'Failed to select product image. Please try again.' },
      { status: 500, headers }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}