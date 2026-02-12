import fs from 'fs';
import { PDFParse } from 'pdf-parse';
import { supabase } from '../config/supabase.js';

export const processConstitutionPDF = async (filePath: string) => {
  const dataBuffer = fs.readFileSync(filePath);

  try {
    const parser = new PDFParse({ data: dataBuffer });
    const textResult = await parser.getText();
    const infoResult = await parser.getInfo();
    
    const text = textResult.text;
    console.log(`PDF text length: ${text.length} characters.`);
    
    // Log the first 500 characters to see the structure
    console.log('PDF Preview:', text.substring(0, 500).replace(/\n/g, ' '));

    // Split text into articles based on "Article [Number]" pattern
    // Improved regex to handle cases where Article might be capitalized or followed by a period/space
    const articleRegex = /(?:Article|ARTICLE)\s+(\d+)/gi;
    let match;
    let lastIndex = 0;

    // First, find all article positions
    const matches: { number: number, start: number }[] = [];
    while ((match = articleRegex.exec(text)) !== null) {
      matches.push({
        number: parseInt(match[1]),
        start: match.index
      });
    }

    // Now extract content between matches
    const articleMap = new Map<number, any>();
    
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const next = matches[i + 1];
      const end = next ? next.start : text.length;
      
      let rawContent = text.substring(current.start, end).trim();
      
      const lines = rawContent.split('\n');
      const firstLine = lines[0];
      const articleTitle = firstLine.replace(/Article\s+\d+\.?\s*/i, '').trim() || `Article ${current.number}`;
      const articleContent = lines.slice(1).join('\n').trim() || rawContent;

      articleMap.set(current.number, {
        article_number: current.number,
        article_title: articleTitle,
        article_content: articleContent,
        chapter: Math.floor(current.number / 10) + 1,
        chapter_title: `Chapter ${Math.floor(current.number / 10) + 1}`
      });
    }

    const articles = Array.from(articleMap.values());
    console.log(`Parsed ${articles.length} unique articles from PDF (removed duplicates).`);

    if (articles.length > 0) {
      console.log(`Starting insertion of ${articles.length} articles into Supabase...`);
      // Insert into Supabase in batches to avoid payload limits
      const batchSize = 50;
      for (let i = 0; i < articles.length; i += batchSize) {
        const batch = articles.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('constitution_articles')
          .upsert(batch, { onConflict: 'article_number' })
          .select();

        if (error) {
          console.error(`Error inserting batch ${i / batchSize}:`, JSON.stringify(error, null, 2));
          throw new Error(`Database Insertion Error: ${error.message}`);
        } else {
          console.log(`Successfully inserted batch ${i / batchSize + 1}. Records inserted: ${data?.length || 0}`);
        }
      }
      console.log('Successfully completed all database insertions.');
    } else {
      console.warn('No articles were parsed from the text. Check the regex pattern.');
    }
    
    await parser.destroy();

    return {
      pages: textResult.total,
      articlesFound: articles.length,
      textLength: text.length
    };
  } catch (error: any) {
    console.error('PDF Processing Error:', error);
    throw new Error('Failed to process PDF.');
  }
};
