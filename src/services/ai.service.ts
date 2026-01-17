import { Injectable } from '@angular/core';
import { GoogleGenAI } from "@google/genai";

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private ai: GoogleGenAI;

  constructor() {
    // Initialize Gemini Client
    // process.env.API_KEY is guaranteed to be available in this environment
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async generateBlessing(mood: string): Promise<string> {
    try {
      const prompt = `请写一句简短、鼓励且略带幽默的中文祝福语（最多20个字），送给即将参加期末考试的学生。
      语气风格应该是: ${mood}。
      只返回文本内容，不要包含引号或其他解释。`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      return response.text.trim();
    } catch (error) {
      console.error('AI Generation failed', error);
      return "考试加油！全都会做，蒙的全对！"; // Fallback
    }
  }
}